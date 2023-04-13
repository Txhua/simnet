package service

type Message struct {
	msgID int64
	data  []byte
}

func (msg *Message) MsgID() int64 {
	return msg.msgID
}

func (msg *Message) MsgData() []byte {
	return msg.data
}

func (msg *Message) SetMsgID(id int64) {
	msg.msgID = id
}

func (msg *Message) SetMsgData(data []byte) {
	msg.data = data
}
