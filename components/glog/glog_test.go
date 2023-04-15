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
	log := NewLog()
	log.Debugf("%s", "hello glog")
}
