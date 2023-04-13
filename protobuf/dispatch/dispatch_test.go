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
	"simnet/protobuf/pb"
	"testing"
)

type User struct {
}

//func (u *User) MessageCallback(ctx context.Context, message proto.Message) (proto.Message, error) {
//	//TODO implement me
//	panic("implement me")
//}

func (u *User) MessageCallback(ctx context.Context, info *pb.UserInfo) {

}

func Tee(i Teacher) {

}

type Teacher interface {
	Get(a int)
}

type Tes struct {
}

func (t *Tes) Get(b int) {

}

func TestMessageDispatch_Dispatch(t *testing.T) {
	u := &User{}
	dispatch := NewMessageDispatch()
	Register[*pb.UserInfo](dispatch, 1, u.MessageCallback)
}
