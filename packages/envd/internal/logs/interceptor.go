package logs

import (
	"context"
	"strconv"
	"sync/atomic"

	"connectrpc.com/connect"
	"github.com/rs/zerolog"
)

type StreamID string

const (
	StreamIDKey StreamID = "stream_id"
)

var streamID = atomic.Int32{}

func AssignStreamID() string {
	id := streamID.Add(1)

	return strconv.Itoa(int(id))
}

func NewUnaryLogInterceptor(logger *zerolog.Logger) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			res, err := next(ctx, req)

			logger.Err(err).
				Str("method", req.Spec().Procedure).
				Interface("request", req).
				Interface("response", res).
				Send()

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
	ctx = context.WithValue(ctx, StreamIDKey, AssignStreamID())

	logger.Info().
		Str("method", req.Spec().Procedure).
		Str("stream_id", ctx.Value(StreamIDKey).(string)).
		Interface("request", req).
		Send()

	err := handler(ctx, req, stream)
	logger.Err(err).
		Str("method", req.Spec().Procedure).
		Str("stream_id", ctx.Value(StreamIDKey).(string)).
		Interface("response", nil).
		Send()

	return err
}

func LogsServerEvent[T any](
	ctx context.Context,
	logger *zerolog.Logger,
	req *connect.Request[T],
	event interface{},
) {
	logger.Info().
		Str("method", req.Spec().Procedure).
		Str("stream_id", ctx.Value(StreamIDKey).(string)).
		Interface("event", event).
		Send()
}
