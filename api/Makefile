openapi := ../shared/api/openapi.yml

GCP_PROJECT := devbookhq
IMAGE := orchestration/api

generate:
	oapi-codegen -old-config-style -generate gin --package api $(openapi) > internal/api/api.gen.go
	oapi-codegen -old-config-style -generate types --package api $(openapi) > internal/api/types.gen.go
	oapi-codegen -old-config-style -generate spec --package api $(openapi) > internal/api/spec.gen.go

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/api .

run:
	GOOS=linux go build -o bin/api ./cmd
	NOMAD_ADDRESS=http://34.149.1.201 ./bin/api --port 3000 -telemetry-api=$(telemetry-api)

push:
	docker build --tag us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE) .
	docker push us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE)
