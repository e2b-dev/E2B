package permissions

import (
	"strconv"
	"time"

	"connectrpc.com/connect"
)

func GetKeepAliveTicker[T any](req *connect.Request[T]) (<-chan time.Time, func()) {
	keepAliveIntervalHeader := req.Header().Get("X-Keepalive-Interval")

	keepAliveIntervalInt, err := strconv.Atoi(keepAliveIntervalHeader)
	if err != nil {
		return nil, func() {}
	}

	ticker := time.NewTicker(time.Duration(keepAliveIntervalInt) * time.Second)

	return ticker.C, func() {
		ticker.Stop()
	}
}
