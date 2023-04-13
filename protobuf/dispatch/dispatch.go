/*
 * @Date: 2023/4/13
 * @LastEditors: txhua
 * @LastEditTime: 周四
 * @FilePath: protobuf/dispatch
 * @Description:
 */

package dispatch

import (
	"context"
	"fmt"
	"github.com/golang/protobuf/proto"
	"reflect"
	"simnet/api"
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

	t := reflectType.Kind()
	fmt.Println(t)
	info := &handleFunctionInfo{
		Type:  reflectType,
		Value: reflectValue,
	}
	md.handle[mid] = info
}

func Register[_Type proto.Message](dispatch *MessageDispatch, mid int64, handle func(ctx context.Context, message _Type)) {
	dispatch.Register(mid, handle)
}

func (md *MessageDispatch) Dispatch(request api.IRequest) {
	msgId := request.Msg().MsgID()
	msg := request.Msg().MsgData()

	var (
		info *handleFunctionInfo
		pb   proto.Message
		ok   bool
	)

	info, ok = md.handle[msgId]
	if !ok {
		return
	}
	inputObject := reflect.New(info.Type.In(1).Elem()).Elem()
	if pb, ok = inputObject.Interface().(proto.Message); !ok {
		return
	}

	err := proto.Unmarshal(msg, pb)
	if err != nil {
		return
	}

	var inputValues = []reflect.Value{
		reflect.ValueOf(context.Background()),
	}

	inputValues = append(inputValues, inputObject)

	_ = info.Value.Call(inputValues)
}
