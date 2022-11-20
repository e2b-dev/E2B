upload:
	./upload.sh

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/devbookd .

build-darwin:
	GOOS=darwin go build -a -o bin/darwin/devbookd .

build-debug-devbookd:
	CGO_ENABLED=1 GOOS=linux go build -race -gcflags=all="-N -l" -o bin/debug/devbookd

build-docker:
	DOCKER_BUILDKIT=1 docker build -t devbookd-debug . -f debug.Dockerfile

start-docker:
	docker run \
	--name devbookd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	--rm \
	-it devbookd-debug \
	/bin/ash

start-devbookd-docker:
	docker run \
	--name devbookd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	--rm \
	-i devbookd-debug \
	/usr/bin/devbookd -debug | jq .

start-debug-docker:
	docker run \
	--name devbookd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	-d devbookd-debug sh -l -c "/go/bin/dlv --listen=:2345 --headless=true --log=true --log-output=debugger,debuglineerr,gdbwire,lldbout,rpc --accept-multiclient --api-version=2 exec /usr/bin/devbookd"

stop-debug-docker:
	docker kill `docker ps -a -q --filter ancestor=devbookd-debug`

connect-wscat:
	npx -y wscat -c ws://127.0.0.1:49982/ws

# You run the parametrized command like this:
# make hostname=s3izkj4c-beba8075.ondevbook.com metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 https://49982-$(hostname)/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

install-profiler-deps:
	sudo apt update && sudo apt install graphviz

# Build devbookd and start a detached container you can connect to with a debugger
run-debug:
	make build-docker
	make start-debug-docker

# Build devbookd and start a interactive container with devbookd as a main process
run-devbookd:
	make build-docker
	make start-devbookd-docker

# Build devbookd and start a interactive container where you can start devbookd manually
run-env:
	make build-docker
	make start-docker
