/*
 * @Date: 2023/4/13
 * @LastEditors: txhua
 * @LastEditTime: 周四
 * @FilePath: api
 * @Description:
 */

package api

type IRequest interface {
	Msg() IMessage
}
