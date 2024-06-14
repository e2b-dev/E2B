package logs

import (
	"context"
	"strconv"
	"sync/atomic"

	"connectrpc.com/connect"
	"github.com/rs/zerolog"
)

type RequestID string

const (
	RequestIDKey RequestID = "request_id"
)

var requestID = atomic.Int32{}

func AssignRequestID() string {
	id := requestID.Add(1)

	return strconv.Itoa(int(id))
}

func NewUnaryLogInterceptor(logger *zerolog.Logger) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			res, err := next(ctx, req)

			l := logger.
				Err(err).
				Str("method", req.Spec().Procedure).
				Str(string(RequestIDKey), AssignRequestID())

			if err != nil {
				l = l.Int("error_code", int(connect.CodeOf(err)))
			}

			if req != nil {
				l = l.Interface("request", req.Any())
			}

			if res != nil && err == nil {
				l = l.Interface("response", res.Any())
			}

			l.Send()

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
	ctx = context.WithValue(ctx, RequestIDKey, AssignRequestID())

	l := logger.Info().
		Str("method", req.Spec().Procedure).
		Str(string(RequestIDKey), ctx.Value(RequestIDKey).(string))

	if req != nil {
		l = l.Interface("request", req.Any())
	}

	l.Send()

	err := handler(ctx, req, stream)

	errL := logger.Err(err).
		Str("method", req.Spec().Procedure).
		Str(string(RequestIDKey), ctx.Value(RequestIDKey).(string))

	if err != nil {
		errL = errL.Int("error_code", int(connect.CodeOf(err)))
	}

	errL.Send()

	return err
}

func LogStreamEvent(
	ctx context.Context,
	logger *zerolog.Event,
	method string,
	event interface{},
) {
	logger.
		Str("method", method).
		Str(string(RequestIDKey), ctx.Value(RequestIDKey).(string)).
		Interface("event", event).
		Send()
}

func LogClientStreamWithoutEvents[T any, R any](
	ctx context.Context,
	logger *zerolog.Logger,
	stream *connect.ClientStream[T],
	handler func(ctx context.Context, stream *connect.ClientStream[T]) (*connect.Response[R], error),
) (*connect.Response[R], error) {
	ctx = context.WithValue(ctx, RequestIDKey, AssignRequestID())

	logger.Info().
		Str("method", stream.Spec().Procedure).
		Str(string(RequestIDKey), ctx.Value(RequestIDKey).(string)).
		Send()

	res, err := handler(ctx, stream)

	l := logger.Err(err).
		Str("method", stream.Spec().Procedure).
		Str(string(RequestIDKey), ctx.Value(RequestIDKey).(string))

	if err != nil {
		l = l.Int("error_code", int(connect.CodeOf(err)))
	}

	if res != nil && err == nil {
		l = l.Interface("response", res.Any())
	}

	l.Send()

	return res, err
}
