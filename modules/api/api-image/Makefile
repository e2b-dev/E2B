generate:
	oapi-codegen -generate gin --package handlers openapi.yml > internal/handlers/api.gen.go
	oapi-codegen -generate types --package handlers openapi.yml > internal/handlers/types.gen.go
	oapi-codegen -generate spec --package handlers openapi.yml > internal/handlers/spec.gen.go

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/api ./cmd

publish-mkfcenv:
	./publish-mkfcenv.sh

run:
	NOMAD_ADDRESS=http://34.149.1.201 ./bin/api --port 3000
