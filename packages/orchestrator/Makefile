ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}


openapi := openapi.yml
codegen := go run github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

.PHONY: generate
generate:
	rm -rf internal/db/ent
	go generate ./internal/db/schema/generate.go
	$(codegen) -old-config-style -generate gin --package api $(openapi) > internal/api/api.gen.go
	$(codegen) -old-config-style -generate types --package api $(openapi) > internal/api/types.gen.go
	$(codegen) -old-config-style -generate spec --package api $(openapi) > internal/api/spec.gen.go

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
