# Orchestration API

> NOTE: `GIN_MODE=release` env var is set in Docker so the container is ready for production.

> NOTE: Change `NomadAddress` in the `pkg/nomad/client.go` to match the address of the Nomad server.

## Development
Generate gin server scaffolding (`internal/api/*.gen.go` files) from the `openapi.yml` file by running `make generate`. Then define handlers for the routes in the `internal/api/store.go`.

## Articles
- https://github.com/deepmap/oapi-codegen
- https://support.smartbear.com/swaggerhub/docs/tutorials/openapi-3-tutorial.html
- https://editor.swagger.io/
