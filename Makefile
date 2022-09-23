build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/devbookd .

build-darwin:
	GOOS=darwin go build -o bin/darwin/devbookd .

build-debug-devbookd:
	CGO_ENABLED=1 GOOS=linux go build -race -gcflags=all="-N -l" -o bin/darwing/debug/devbookd

build-docker:
	docker build -t devbookd-debug . -f debug.Dockerfile

start-docker:
	docker run -p 8081:8081 -p 8010:8010 -p 2345:2345 -p 9999:9999 -p 5555:5555 -it devbookd-debug /bin/ash

start-devbookd-docker:
	docker run -p 8081:8081 -p 8010:8010 -p 2345:2345 -p 9999:9999 -p 5555:5555 -it devbookd-debug /usr/bin/devbookd

start-debug-docker:
	docker run -p 8081:8081 -p 8010:8010 -p 2345:2345 -p 9999:9999 -p 5555:5555 -d devbookd-debug sh -l -c "/go/bin/dlv --listen=:2345 --headless=true --log=true --log-output=debugger,debuglineerr,gdbwire,lldbout,rpc --accept-multiclient --api-version=2 exec /usr/bin/devbookd"

stop-debug-docker:
	docker kill `docker ps -a -q --filter ancestor=devbookd-debug`

connect-wscat:
	npx -y wscat -c ws://127.0.0.1:8010/ws

# You run the parametrized command like this:
# make hostname=s3izkj4c-beba8075.ondevbook.com metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 https://8010-$(hostname)/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

install-profiler-deps:
	sudo apt update && sudo apt install graphviz

# Build devbookd and start a detached container you can connect to with a debugger
debug:
	# make build-debug-devbookd
	make build-docker
	make start-debug-docker

# Build devbookd and start a interactive container with devbookd as a main process
run-devbookd:
	# make build-debug-devbookd
	make build-docker
	make start-devbookd-docker

# Build devbookd and start a interactive container where you can start devbookd manually
run-env:
	# make build-debug-devbookd
	make build-docker
	make start-docker
