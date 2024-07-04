package logs

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync/atomic"

	"connectrpc.com/connect"
	"github.com/rs/zerolog"
)

type OperationID string

const (
	OperationIDKey    OperationID = "operation_id"
	DefaultHTTPMethod string      = "POST"
)

var operationID = atomic.Int32{}

func AssignOperationID() string {
	id := operationID.Add(1)

	return strconv.Itoa(int(id))
}

func AddRequestIDToContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, OperationIDKey, AssignOperationID())
}

func formatMethod(method string) string {
	parts := strings.Split(method, ".")
	if len(parts) < 2 {
		return method
	}

	split := strings.Split(parts[1], "/")
	if len(split) < 2 {
		return method
	}

	servicePart := split[0]
	servicePart = strings.ToUpper(servicePart[:1]) + servicePart[1:]

	methodPart := split[1]
	methodPart = strings.ToLower(methodPart[:1]) + methodPart[1:]

	return fmt.Sprintf("%s %s", servicePart, methodPart)
}

func NewUnaryLogInterceptor(logger *zerolog.Logger) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			ctx = AddRequestIDToContext(ctx)

			res, err := next(ctx, req)

			l := logger.
				Err(err).
				Str("method", DefaultHTTPMethod+" "+req.Spec().Procedure).
				Str(string(OperationIDKey), ctx.Value(OperationIDKey).(string))

			if err != nil {
				l = l.Int("error_code", int(connect.CodeOf(err)))
			}

			if req != nil {
				l = l.Interface("request", req.Any())
			}

			if res != nil && err == nil {
				l = l.Interface("response", res.Any())
			}

			if res == nil && err == nil {
				l = l.Interface("response", nil)
			}

			l.Msg(formatMethod(req.Spec().Procedure))

			return res, err
		})
	}

	return connect.UnaryInterceptorFunc(interceptor)
}

func LogServerStreamWithoutEvents[T any, R any](
	ctx context.Context,
	logger *zerolog.Logger,
	req *connect.Request[R],
	stream *connect.ServerStream[T],
	handler func(ctx context.Context, req *connect.Request[R], stream *connect.ServerStream[T]) error,
) error {
	ctx = AddRequestIDToContext(ctx)

	l := logger.Info().
		Str("method", DefaultHTTPMethod+" "+req.Spec().Procedure).
		Str(string(OperationIDKey), ctx.Value(OperationIDKey).(string))

	if req != nil {
		l = l.Interface("request", req.Any())
	}

	l.Msg(fmt.Sprintf("%s (server stream start)", formatMethod(req.Spec().Procedure)))

	err := handler(ctx, req, stream)

	errL := logger.Err(err).
		Str("method", DefaultHTTPMethod+" "+req.Spec().Procedure).
		Str(string(OperationIDKey), ctx.Value(OperationIDKey).(string))

	if err != nil {
		errL = errL.Int("error_code", int(connect.CodeOf(err)))
	} else {
		errL = errL.Interface("response", nil)
	}

	errL.Msg(fmt.Sprintf("%s (server stream end)", formatMethod(req.Spec().Procedure)))

	return err
}

func LogClientStreamWithoutEvents[T any, R any](
	ctx context.Context,
	logger *zerolog.Logger,
	stream *connect.ClientStream[T],
	handler func(ctx context.Context, stream *connect.ClientStream[T]) (*connect.Response[R], error),
) (*connect.Response[R], error) {
	ctx = AddRequestIDToContext(ctx)

	logger.Info().
		Str("method", DefaultHTTPMethod+" "+stream.Spec().Procedure).
		Str(string(OperationIDKey), ctx.Value(OperationIDKey).(string)).
		Msg(fmt.Sprintf("%s (client stream start)", formatMethod(stream.Spec().Procedure)))

	res, err := handler(ctx, stream)

	l := logger.Err(err).
		Str("method", DefaultHTTPMethod+" "+stream.Spec().Procedure).
		Str(string(OperationIDKey), ctx.Value(OperationIDKey).(string))

	if err != nil {
		l = l.Int("error_code", int(connect.CodeOf(err)))
	}

	if res != nil && err == nil {
		l = l.Interface("response", res.Any())
	}

	if res == nil && err == nil {
		l = l.Interface("response", nil)
	}

	l.Msg(fmt.Sprintf("%s (client stream end)", formatMethod(stream.Spec().Procedure)))

	return res, err
}
