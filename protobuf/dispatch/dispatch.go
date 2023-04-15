package dispatch

import (
	"context"
	"google.golang.org/protobuf/proto"
	"reflect"
	"simnet/api"
	"simnet/components/glog"
	"simnet/constants"
)

type (
	IMessageCallback interface {
		OnMessage(ctx context.Context, message proto.Message) (proto.Message, error)
		GetType() reflect.Type
	}
	callbackAble[_Type any] struct {
		callback  func(ctx context.Context, message _Type) (proto.Message, error)
		protoType reflect.Type
	}
	MessageDispatch struct {
		handle map[int64]IMessageCallback
	}
)

func (cb *callbackAble[_Type]) GetType() reflect.Type {
	return cb.protoType
}

func (cb *callbackAble[_Type]) OnMessage(ctx context.Context, message proto.Message) (proto.Message, error) {
	// 判断传入的消息对象是否属于期望的类型
	p, ok := message.(_Type)
	if !ok {
		return nil, constants.ErrWrongValueType
	}

	// 调用回调函数处理消息，并返回处理结果
	return cb.callback(ctx, p)
}

func NewMessageDispatch() *MessageDispatch {
	return &MessageDispatch{
		handle: make(map[int64]IMessageCallback),
	}
}

func (md *MessageDispatch) Dispatch(serialize api.ISerializer, request api.IRequest) (response proto.Message, err error) {
	msg := request.Message()
	msgId := msg.MsgID()
	msgData := msg.MsgData()
	info, ok := md.handle[msgId]
	if !ok {
		glog.Logger.Errorf("msgId not register! msgId : %d ", msgId)
		return nil, constants.ErrWrongMsgIDRegister
	}
	reflectType := info.GetType()
	inputObject := reflect.New(reflectType).Elem()
	err = serialize.Unmarshal(msgData, inputObject.Addr().Interface())
	if err != nil {
		glog.Logger.Errorf("unmarshal message error! msgId : %d ", msgId)
		return nil, err
	}
	pb, ok := inputObject.Addr().Interface().(proto.Message)
	if !ok {
		return nil, constants.ErrWrongValueProtobuf
	}

	return info.OnMessage(context.Background(), pb)
}

func Register[_Type proto.Message](dispatch *MessageDispatch, mid int64, handle func(ctx context.Context, message _Type) (proto.Message, error)) {
	if _, ok := dispatch.handle[mid]; ok {
		return
	}
	// 类型检查
	var m _Type
	argType := reflect.TypeOf(m).Elem()
	if argType != reflect.TypeOf(handle).In(1).Elem() {
		glog.Logger.Panicf("register error: expected argument type %v, but got %v", argType, reflect.TypeOf(handle).In(1).Elem())
	}
	dispatch.handle[mid] = &callbackAble[_Type]{
		callback:  handle,
		protoType: argType,
	}
}
