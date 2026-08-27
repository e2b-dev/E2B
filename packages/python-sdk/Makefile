ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../..)

generate-api:
	redocly bundle python-sdk --config $(ROOT_DIR)/redocly.yaml -o $(ROOT_DIR)/spec/openapi_generated.python-sdk.yml
	openapi-python-client generate --output-path $(ROOT_DIR)/packages/python-sdk/e2b/api/api --overwrite --path $(ROOT_DIR)/spec/openapi_generated.python-sdk.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api
	ruff format .

generate-volume-api:
	redocly bundle volume --config $(ROOT_DIR)/redocly.yaml -o $(ROOT_DIR)/spec/openapi_generated.volume.yml
	openapi-python-client generate --output-path $(ROOT_DIR)/packages/python-sdk/e2b/volume/api --overwrite --path $(ROOT_DIR)/spec/openapi_generated.volume.yml
	rm -rf e2b/volume/client
	mv e2b/volume/api/e2b_api_client e2b/volume/client
	rm -rf e2b/volume/api
	ruff format .

# Requires `buf` and the codegen dependency group (`make init`), which
# provides the `protoc-gen-connectrpc` plugin.
generate-envd:
	cd $(ROOT_DIR)/spec/envd && pwd && buf generate --template buf-python.gen.yaml
	./scripts/fix-python-pb.sh

	ruff format .

generate: generate-api generate-envd generate-mcp generate-volume-api

# Install the code-generation toolchain into the workspace env. After this, run
# the generators locally with e.g. `uv run --all-packages make generate-api`.
init:
	uv sync --all-packages --group codegen

typecheck:
	ty check

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .

generate-mcp:
	datamodel-codegen \
			--input ../../spec/mcp-server.json \
			--input-file-type jsonschema \
			--output e2b/sandbox/mcp.py \
			--output-model-type typing.TypedDict \
			--target-python-version 3.10 \
			--class-name McpServer \
			--use-field-description \
			--disable-timestamp \
			--extra-fields forbid

.PHONY: test
test:
	uv run --all-packages pytest --verbose --numprocesses=4
