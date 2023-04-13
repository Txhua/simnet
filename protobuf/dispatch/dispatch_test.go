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
	"simnet/protobuf"
	"simnet/protobuf/pb"
	"simnet/service"
	"testing"

	"google.golang.org/protobuf/proto"
)

var dispatch = NewMessageDispatch()

type User struct {
}

//func (u *User) MessageCallback(ctx context.Context, message proto.Message) (proto.Message, error) {
//	//TODO implement me
//	panic("implement me")
//}

func (u *User) MessageCallback(ctx context.Context, info *pb.UserInfo) (proto.Message, error) {
	resp := &pb.Reply{}
	resp.Id = info.GetId()
	resp.Age = info.GetAge()
	return resp, nil
}

func (u *User) Handle(ctx context.Context, info *pb.UserInfo) (proto.Message, error) {
	resp := &pb.Reply{}
	resp.Id = info.GetId()
	resp.Age = info.GetAge()
	return resp, nil
}

func TestMessageDispatch_Dispatch(t *testing.T) {
	u := &User{}
	Register[*pb.UserInfo](dispatch, 2, u.MessageCallback)

	req := &pb.UserInfo{}
	req.Id = 12
	req.Age = 25

	str, err := proto.Marshal(req)
	if err != nil {
		panic(err)
	}

	msg := &service.Message{}
	msg.SetMsgID(2)
	msg.SetMsgData(str)

	re := &service.Request{}
	re.SetMessage(msg)

	ser := protobuf.NewSerializer()
	resp, err := dispatch.Dispatch(ser, re)

	fmt.Println(resp)

}
