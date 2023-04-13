package protobuf

import "google.golang.org/protobuf/proto"

// Serializer implements the serialize.Serializer interface
type Serializer struct{}

// NewSerializer returns a new Serializer.
func NewSerializer() *Serializer {
	return &Serializer{}
}

// Marshal returns the protobuf encoding of v.
func (s *Serializer) Marshal(v interface{}) ([]byte, error) {
	pb, ok := v.(proto.Message)
	if !ok {
		return nil, nil
	}
	return proto.Marshal(pb)
}

// Unmarshal parses the protobuf-encoded data and stores the result
// in the value pointed to by v.
func (s *Serializer) Unmarshal(data []byte, v interface{}) error {
	pb, ok := v.(proto.Message)
	if !ok {
		return nil
	}
	return proto.Unmarshal(data, pb)
}
