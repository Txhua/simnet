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
	"google.golang.org/protobuf/proto"
)

type MessageDispatch[_Type proto.Message] struct {
}

type MessageHandle interface {
	MessageCallback(ctx context.Context, message proto.Message)
}
