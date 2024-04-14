package grpc

import (
	"context"

	"google.golang.org/grpc"
)

type DummyConn struct{}

func (dc *DummyConn) Invoke(_ context.Context, _ string, _ any, _ any, _ ...grpc.CallOption) error {
	return nil
}

func (dc *DummyConn) NewStream(_ context.Context, _ *grpc.StreamDesc, _ string, _ ...grpc.CallOption) (grpc.ClientStream, error) {
	return nil, nil
}

func (dc *DummyConn) Close() error {
	return nil
}
