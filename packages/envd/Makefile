ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

client := gcloud compute instances list --format='csv(name)' --project $(GCP_PROJECT_ID) | grep "client"

.PHONY: init
init:
	brew install protobuf
	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2

upload:
	./upload.sh $(GCP_PROJECT_ID)

upload-local:
	./upload-local.sh $(GCP_PROJECT_ID)

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -o bin/envd .

build-debug:
	CGO_ENABLED=1 go build -race -gcflags=all="-N -l" -o bin/debug/envd

build-docker:
	make build
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
	--rm \
	-d envd-debug sh -l -c "/go/bin/dlv --listen=:2345 --headless=true --log=true --log-output=debugger,debuglineerr,gdbwire,lldbout,rpc --accept-multiclient --api-version=2 exec /usr/bin/envd"

stop-debug-docker:
	docker kill `docker ps -a -q --filter ancestor=envd-debug`

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
	gcloud compute ssh $$($(client)) --project $(GCP_PROJECT_ID) -- 'sudo rm -rf /fc-vm/envd && \
	sudo cp /mnt/disks/envs-pipeline/envd /fc-vm/envd'

update-envd-locally:
	make build
	make upload-local
	cp /mnt/disks/envs-pipeline/envd /fc-vm/envd

build-and-upload:
	make build
	make upload-local

.PHONY: generate
generate:
	go generate ./...
	cd spec && buf generate
