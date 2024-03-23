module github.com/e2b-dev/infra/packages/envd

go 1.21

require (
	github.com/creack/pty v1.1.18
	github.com/drael/GOnetstat v0.0.0-20201004132414-bf4a88b0bdab
	github.com/ethereum/go-ethereum v1.13.4
	github.com/fsnotify/fsnotify v1.7.0
	github.com/gorilla/handlers v1.5.1
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/websocket v1.5.0
	github.com/orcaman/concurrent-map/v2 v2.0.1
	github.com/rs/xid v1.5.0
	go.uber.org/zap v1.26.0
)

require (
	github.com/Microsoft/go-winio v0.6.1 // indirect
	github.com/deckarep/golang-set/v2 v2.3.1 // indirect
	github.com/felixge/httpsnoop v1.0.3 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-stack/stack v1.8.1 // indirect
	github.com/holiman/uint256 v1.2.3 // indirect
	github.com/shirou/gopsutil v3.21.11+incompatible // indirect
	github.com/tklauser/go-sysconf v0.3.12 // indirect
	github.com/tklauser/numcpus v0.6.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.3 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/crypto v0.17.0 // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/mod v0.13.0 // indirect
	golang.org/x/sys v0.15.0 // indirect
	golang.org/x/tools v0.14.0 // indirect
)

replace github.com/e2b-dev/infra/packages/shared v0.0.0 => ../shared
