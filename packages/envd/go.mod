module github.com/e2b-dev/infra/packages/envd

go 1.21

require (
	connectrpc.com/connect v1.16.2
	github.com/creack/pty v1.1.18
	github.com/drael/GOnetstat v0.0.0-20201004132414-bf4a88b0bdab
	github.com/e2b-dev/infra/packages/shared v0.0.0
	github.com/ethereum/go-ethereum v1.13.4
	github.com/fsnotify/fsnotify v1.7.0
	github.com/gogo/status v1.1.1
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/websocket v1.5.0
	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0
	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.1.0
	github.com/rs/xid v1.5.0
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.48.0
	go.uber.org/zap v1.26.0
	google.golang.org/grpc v1.61.1
	google.golang.org/protobuf v1.33.0
)

require (
	github.com/Microsoft/go-winio v0.6.1 // indirect
	github.com/deckarep/golang-set/v2 v2.3.1 // indirect
	github.com/go-logr/logr v1.4.1 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-stack/stack v1.8.1 // indirect
	github.com/gogo/googleapis v0.0.0-20180223154316-0cd9801be74a // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/holiman/uint256 v1.2.3 // indirect
	github.com/orcaman/concurrent-map/v2 v2.0.1 // indirect
	github.com/shirou/gopsutil v3.21.11+incompatible // indirect
	github.com/tklauser/go-sysconf v0.3.12 // indirect
	github.com/tklauser/numcpus v0.6.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.3 // indirect
	go.opentelemetry.io/otel v1.23.0 // indirect
	go.opentelemetry.io/otel/metric v1.23.0 // indirect
	go.opentelemetry.io/otel/trace v1.23.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/crypto v0.21.0 // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/mod v0.13.0 // indirect
	golang.org/x/net v0.23.0 // indirect
	golang.org/x/sys v0.18.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/tools v0.14.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240213162025-012b6fc9bca9 // indirect
)

replace github.com/e2b-dev/infra/packages/shared v0.0.0 => ../shared
