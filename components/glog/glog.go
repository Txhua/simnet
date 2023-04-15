/*
 * @Date: 2023/4/15
 * @LastEditors: txhua
 * @LastEditTime: 周六
 * @FilePath: components/glog
 * @Description:
 */

package glog

import (
	"github.com/natefinch/lumberjack"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"os"
	"time"
)

var (
	Logger *zap.SugaredLogger
)

func InitLog() {
	config := zap.NewProductionConfig()
	config.EncoderConfig.EncodeTime = func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendString(t.Format("2006-01-02 15:04:05"))
	}
	config.EncoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder
	config.EncoderConfig.EncodeCaller = zapcore.ShortCallerEncoder
	config.EncoderConfig.EncodeDuration = func(d time.Duration, enc zapcore.PrimitiveArrayEncoder) {
		enc.AppendInt64(int64(d) / 1000000)
	}

	splitFunc := func(filename string) *lumberjack.Logger {
		return &lumberjack.Logger{
			Filename:   filename,
			MaxSize:    100, // 每个日志文件最大100MB
			MaxBackups: 3,   // 最多保留3个备份文件
			MaxAge:     1,   // 日志文件最长保存1天
			LocalTime:  true,
		}
	}

	// 创建 DEBUG、INFO 和 ERROR 三个级别的日志文件归档器
	debugArchive := splitFunc("../../storage/logs/debug.log")
	infoArchive := splitFunc("../../storage/logs/info.log")
	errorArchive := splitFunc("../../storage/logs/error.log")
	panicArchive := splitFunc("../../storage/logs/panic.log")

	// 创建对应的 Syncer 对象
	debugSyncer := zapcore.AddSync(debugArchive)
	infoSyncer := zapcore.AddSync(infoArchive)
	errorSyncer := zapcore.AddSync(errorArchive)
	panicSyncer := zapcore.AddSync(panicArchive)

	// 根据不同的日志等级创建对应的 Core
	debugCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(config.EncoderConfig),
		zapcore.NewMultiWriteSyncer(debugSyncer, os.Stdout),
		zap.NewAtomicLevelAt(zap.DebugLevel),
	)

	infoCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(config.EncoderConfig),
		infoSyncer,
		zap.NewAtomicLevelAt(zap.InfoLevel),
	)

	errorCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(config.EncoderConfig),
		errorSyncer,
		zap.NewAtomicLevelAt(zap.ErrorLevel),
	)

	panicCore := zapcore.NewCore(
		zapcore.NewConsoleEncoder(config.EncoderConfig),
		zapcore.NewMultiWriteSyncer(panicSyncer, os.Stderr),
		zap.NewAtomicLevelAt(zap.ErrorLevel),
	)

	logger := zap.New(zapcore.NewTee(debugCore, infoCore, errorCore, panicCore), zap.AddCaller())
	Logger = logger.Sugar()
}
