package logging

import grpc_zap "github.com/grpc-ecosystem/go-grpc-middleware/logging/zap"

func WithoutHealthCheck() grpc_zap.Option {
	return grpc_zap.WithDecider(func(fullMethodName string, err error) bool {
		// will not log gRPC calls if it was a call to healthcheck and no error was raised
		if err == nil && fullMethodName == "/grpc.health.v1.Health/Check" {
			return false
		}

		// by default everything will be logged
		return true
	})
}
