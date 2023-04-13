#!/bin/bash


wd=`pwd`
osName=`uname`

#if [ "$osName" = "Linux" ]; then
#  export PATH="$wd/bin/linux:$PATH"
#else
#  export PATH="$wd/bin/mac:$PATH"
#fi

root="/root/TxhuaCode/go/simnet/protobuf/proto"
pkg="/pb"

for file in $root/*
do
  f=${file##*/}

  echo "generate: $root/$f"
#  opts="$opts --go_opt=M$f=$pkg --go-grpc_opt=M$f=$pkg"
  opts="$opts --go_opt=M$f=$pkg"

  fs="$fs $f"
done

#protoc --proto_path=$root --go_out=. --go-grpc_out=. --go-grpc_opt=require_unimplemented_servers=false $opts $fs

protoc --proto_path=$root --go_out=. $opts $fs


echo "done!"
