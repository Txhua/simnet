package service

import "simnet/api"

type Request struct {
	msg api.IMessage
}

func (req *Request) Message() api.IMessage {
	return req.msg
}

func (req *Request) SetMessage(msg api.IMessage) {
	req.msg = msg
}
