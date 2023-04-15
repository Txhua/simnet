package constants

import "errors"

var (
	ErrWrongValueType     = errors.New("protobuf: convert on wrong type value")
	ErrWrongValueProtobuf = errors.New("failed to convert message to proto.Message")
	ErrWrongUnmarshal     = errors.New("unmarshal message error")
	ErrWrongMsgIDRegister = errors.New("msgId not register")
)
