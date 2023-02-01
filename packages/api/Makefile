openapi := ../../openapi.yml

GCP_PROJECT := devbookhq
IMAGE := orchestration/api

generate:
	oapi-codegen -old-config-style -generate gin --package api $(openapi) > internal/api/api.gen.go
	oapi-codegen -old-config-style -generate types --package api $(openapi) > internal/api/types.gen.go
	oapi-codegen -old-config-style -generate spec --package api $(openapi) > internal/api/spec.gen.go

build:
	CGO_ENABLED=0 GOOS=linux go build -o bin/api .

build-debug:
	CGO_ENABLED=1 GOOS=linux go build -race -gcflags=all="-N -l" -o bin/api .

run:
	make build-debug
	API_ADMIN_KEY=test \
	NOMAD_ADDRESS=http://34.149.1.201 \
	NOMAD_TOKEN=$(NOMAD_TOKEN) \
	SUPABASE_KEY=$(SUPABASE_KEY) \
	SUPABASE_URL=$(SUPABASE_URL) \
	CONSUL_TOKEN=$(CONSUL_TOKEN) \
	GOTRACEBACK=crash \
	./bin/api --port 3000 -telemetry-api=$(telemetry-api)

build-docker:
	docker build --tag us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE) .

push-docker:
	docker push us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE)

# You run the parametrized command like this:
# make metric=heap interval=90 profiler
profiler:
	go tool pprof -http :9991 http://localhost:3000/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120
