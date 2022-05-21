openapi := ../../../shared/api/openapi.yml

generate:
	oapi-codegen -generate gin --package api $(openapi) > internal/api/api.gen.go
	oapi-codegen -generate types --package api $(openapi) > internal/api/types.gen.go
	oapi-codegen -generate spec --package api $(openapi) > internal/api/spec.gen.go

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/api ./cmd

publish-mkfcenv:
	./publish-mkfcenv.sh

run:
	GOOS=linux go build -a -o bin/api ./cmd
	NOMAD_ADDRESS=http://34.149.1.201 ./bin/api --port 3000
