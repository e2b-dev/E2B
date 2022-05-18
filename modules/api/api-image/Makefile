generate:
	oapi-codegen -generate gin --package api openapi.yml > internal/api/api.gen.go
	oapi-codegen -generate types --package api openapi.yml > internal/api/types.gen.go
	oapi-codegen -generate spec --package api openapi.yml > internal/api/spec.gen.go

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/api ./cmd

publish-mkfcenv:
	./publish-mkfcenv.sh
