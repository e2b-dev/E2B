# Orchestration API

## TODO

### Sprint 1

Change `NomadAddress` in the `pkg/nomad/client.go` to match the address of the Nomad server.

Expose API to the internet

Handle declarative API container deployment via terraform/nomad - how to sync it with latest image?

### Sprint 2

Uncomment `GIN_MODE=release` env var in Docker so the container is ready for production (it supresses stdout logs).

Add scheduling/pinging system that kills inactive sessions.

Add authentication to the requests

Add parametrization to the session requests (which env to spin, etc)

Add monotoring, logging and rate limiting (consul, envoy, prometheus?)

## Development
Generate gin server scaffolding (`internal/api/*.gen.go` files) from the `openapi.yml` file by running `make generate`. Then define handlers for the routes in the `internal/api/store.go`.

## Resources
- https://github.com/deepmap/oapi-codegen
- https://support.smartbear.com/swaggerhub/docs/tutorials/openapi-3-tutorial.html
- https://editor.swagger.io/
