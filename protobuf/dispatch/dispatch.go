package dispatch

import (
	"context"
	"reflect"
	"simnet/api"

	"google.golang.org/protobuf/proto"
)

const (
	callback = "Handle"
)

type (
	MessageDispatch struct {
		handle map[int64]*handleFunctionInfo
	}

	handleFunctionInfo struct {
		Type  reflect.Type
		Value reflect.Value
	}
)

func NewMessageDispatch() *MessageDispatch {
	return &MessageDispatch{
		handle: make(map[int64]*handleFunctionInfo),
	}
}

func (md *MessageDispatch) Register(mid int64, handle interface{}) {
	if _, ok := md.handle[mid]; ok {
		return
	}
	reflectValue := reflect.ValueOf(handle)
	reflectType := reflectValue.Type()
	switch reflectType.Kind() {
	case reflect.Struct:
		{
			newValue := reflect.New(reflectType)
			newValue.Elem().Set(reflectValue)
			reflectValue = newValue
			reflectType = reflectValue.Type()
			funcInst := reflectValue.MethodByName(callback)
			if !funcInst.IsValid() {
				return
			}
			info, err := md.checkFuncInfo(funcInst.Interface())
			if err != nil {
				panic(err)
			}
			md.handle[mid] = info
			break
		}
	case reflect.Ptr:
		{
			funcInst := reflectValue.MethodByName(callback)
			if !funcInst.IsValid() {
				return
			}
			info, err := md.checkFuncInfo(funcInst.Interface())
			if err != nil {
				panic(err)
			}
			md.handle[mid] = info
			break
		}
	case reflect.Func:
		{
			info := &handleFunctionInfo{
				Type:  reflectType,
				Value: reflectValue,
			}
			md.handle[mid] = info
		}
	}
}

func (md *MessageDispatch) checkFuncInfo(v interface{}) (*handleFunctionInfo, error) {
	reflectType := reflect.TypeOf(v)
	if reflectType.NumIn() != 2 || reflectType.NumOut() != 2 {
		return nil, nil
	}

	if reflectType.In(0).String() != "context.Context" {
		return nil, nil
	}

	if reflectType.Out(1).String() != "error" {
		return nil, nil
	}

	info := &handleFunctionInfo{
		Type:  reflectType,
		Value: reflect.ValueOf(v),
	}
	return info, nil
}

func (md *MessageDispatch) Dispatch(serialize api.ISerializer, request api.IRequest) (response proto.Message, err error) {
	var (
		info        *handleFunctionInfo
		ok          bool
		inputObject reflect.Value
	)

	msg := request.Message()
	msgId := msg.MsgID()
	msgData := msg.MsgData()

	info, ok = md.handle[msgId]
	if !ok {
		return nil, nil
	}

	if info.Type.In(1).Kind() == reflect.Ptr {
		inputObject = reflect.New(info.Type.In(1).Elem())
		err = serialize.Unmarshal(msgData, inputObject.Interface())
		if err != nil {
			return
		}
	} else {
		inputObject = reflect.New(info.Type.In(1).Elem()).Elem()
		err = serialize.Unmarshal(msgData, inputObject.Addr().Interface())
		if err != nil {
			return
		}
	}

	var inputValues = []reflect.Value{
		reflect.ValueOf(context.Background()),
	}

	inputValues = append(inputValues, inputObject)

	results := info.Value.Call(inputValues)
	if response, ok = results[0].Interface().(proto.Message); !ok {
		return
	}

	if !results[1].IsNil() {
		if err, ok = results[1].Interface().(error); ok {
			return
		}
	}
	return response, nil
}

func Register[_Type proto.Message](dispatch *MessageDispatch, mid int64, handle func(ctx context.Context, message _Type) (proto.Message, error)) {
	dispatch.Register(mid, handle)
}
