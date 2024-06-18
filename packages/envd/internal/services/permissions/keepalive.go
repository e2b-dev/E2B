package permissions

import (
	"strconv"
	"time"

	"connectrpc.com/connect"
)

const defaultKeepAliveInterval = 90 * time.Second

func GetKeepAliveTicker[T any](req *connect.Request[T]) (<-chan time.Time, func()) {
	keepAliveIntervalHeader := req.Header().Get("X-Keepalive-Interval")

	var interval time.Duration

	keepAliveIntervalInt, err := strconv.Atoi(keepAliveIntervalHeader)
	if err != nil {
		interval = defaultKeepAliveInterval
	} else {
		interval = time.Duration(keepAliveIntervalInt) * time.Second
	}

	ticker := time.NewTicker(interval)

	return ticker.C, func() {
		ticker.Stop()
	}
}
