/*
 * @Date: 2023/4/13
 * @LastEditors: txhua
 * @LastEditTime: 周四
 * @FilePath: api
 * @Description:
 */

package api

type (
	ISerializer interface {
		Marshaler
		Unmarshaler
	}

	Marshaler interface {
		Marshal(interface{}) ([]byte, error)
	}

	Unmarshaler interface {
		Unmarshal([]byte, interface{}) error
	}
)
