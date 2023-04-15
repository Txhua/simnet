/*
 * @Date: 2023/4/15
 * @LastEditors: txhua
 * @LastEditTime: 周六
 * @FilePath: components/glog
 * @Description:
 */

package glog

import "testing"

func TestLog(t *testing.T) {
	InitLog()
	Logger.Debugf("%s", "hello glog")
}
