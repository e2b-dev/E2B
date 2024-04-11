ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}


openapi := openapi.yml
codegen := go run github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

.PHONY: generate
generate:
	# You need to install protobuf (brew install protobuf) and following go packages: protoc-gen-go, protoc-gen-go-grpc
	# https://grpc.io/docs/languages/go/quickstart/
	@echo "Generating..."
	@protoc --go_out=../shared/pkg/grpc/orchestrator/ --go_opt=paths=source_relative --go-grpc_out=../shared/pkg/grpc/orchestrator/ --go-grpc_opt=paths=source_relative spec.proto
	@echo "Done"

.PHONY: build
build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/orchestrator .

.PHONY: build-debug
build-debug:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -race -gcflags=all="-N -l" -o bin/orchestrator .

.PHONY: upload
upload:
	./upload.sh $(GCP_PROJECT_ID)

.PHONY: update
update:
	make build
	make upload

test:
	sudo CONSUL_TOKEN=$(CONSUL_TOKEN) go run -race -gcflags=all="-N -l" main.go -env idnrwvs3vrde6hknozc0 -instance test-instance-1 -alive 60 -count 1

.PHONY: build-and-upload
build-and-upload: build upload