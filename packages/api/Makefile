-include .env

openapi := ../../spec/openapi.yml
codegen := go run github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

GCP_PROJECT := e2b-prod
IMAGE := orchestration/api

.PHONY: generate
generate:
	$(codegen) -old-config-style -generate gin --package api $(openapi) > internal/api/api.gen.go
	$(codegen) -old-config-style -generate types --package api $(openapi) > internal/api/types.gen.go
	$(codegen) -old-config-style -generate spec --package api $(openapi) > internal/api/spec.gen.go
	go generate ./internal/db/ent/generate.go


.PHONY: build
build:
	CGO_ENABLED=0 go build -o bin/api .

.PHONY: build-debug
build-debug:
	CGO_ENABLED=1 go build -race -gcflags=all="-N -l" -o bin/api .

.PHONY: run
run:
	make build-debug
	API_ADMIN_KEY=test \
	NOMAD_ADDRESS=https://nomad.e2b.dev \
	NOMAD_TOKEN=$(NOMAD_TOKEN) \
	CONSUL_TOKEN=$(CONSUL_TOKEN) \
	SUPABASE_CONNECTION_STRING=$(SUPABASE_CONNECTION_STRING) \
	GOOGLE_CLOUD_STORAGE_BUCKET=$(GOOGLE_CLOUD_STORAGE_BUCKET) \
	GOTRACEBACK=crash \
	GODEBUG=madvdontneed=1 \
	./bin/api --port 3000 -telemetry-api=$(TELEMETRY_API_KEY)

.PHONY: push-docker
push-docker:
	docker buildx install # sets up the buildx as default docker builder (otherwise the command below won't work)
	docker build --platform linux/amd64 --tag us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE) --push .

# You run the parametrized command like this:
# make metric=heap interval=90 profiler
.PHONY: profiler
profiler:
	go tool pprof -http :9991 http://localhost:3000/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120