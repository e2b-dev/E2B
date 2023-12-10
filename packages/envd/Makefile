client := gcloud compute instances list --format='csv(name)' | grep "client"
GCP_PROJECT ?= $$(gcloud config get-value project)

upload:
	./upload.sh $(GCP_PROJECT)

upload-local:
	./upload-local.sh $(GCP_PROJECT)

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -o bin/envd .

build-debug:
	CGO_ENABLED=1 go build -race -gcflags=all="-N -l" -o bin/debug/envd

build-docker:
	DOCKER_BUILDKIT=1 docker build -t envd-debug . -f debug.Dockerfile

start-docker:
	docker run \
	--name envd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	--rm \
	-it envd-debug \
	/bin/bash -l -i

start-envd-docker:
	docker run \
	--name envd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	--rm \
	-i envd-debug \
	/usr/bin/envd -debug

start-debug-docker:
	docker run \
	--name envd \
	-p 49982:49982 \
	-p 2345:2345 \
	-p 9999:9999 \
	-d envd-debug sh -l -c "/go/bin/dlv --listen=:2345 --headless=true --log=true --log-output=debugger,debuglineerr,gdbwire,lldbout,rpc --accept-multiclient --api-version=2 exec /usr/bin/envd"

stop-debug-docker:
	docker kill `docker ps -a -q --filter ancestor=envd-debug`

connect-wscat:
	npx -y wscat -c ws://127.0.0.1:49982/ws

# You run the parametrized command like this:
# make hostname=s3izkj4c-beba8075.ondevbook.com metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 https://49982-$(hostname)/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

install-profiler-deps:
	sudo apt update && sudo apt install graphviz

# Build envd and start a detached container you can connect to with a debugger
run-debug:
	make build-docker
	make start-debug-docker

# Build envd and start a interactive container with envd as a main process
run-envd:
	make build-docker
	make start-envd-docker

# Build envd and start a interactive container where you can start envd manually
run-env:
	make build-docker
	make start-docker

update-envd:
	make build
	make upload-local
	gcloud compute ssh $$($(client)) -- 'sudo rm -rf /fc-vm/envd && \
	sudo cp /mnt/disks/envs-pipeline/envd /fc-vm/envd'

update-envd-locally:
	make build
	make upload-local
	cp /mnt/disks/envs-pipeline/envd /fc-vm/envd

build-and-upload:
	make build
	make upload-local
