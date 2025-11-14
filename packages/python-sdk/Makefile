ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../..)

generate-api:
	python $(ROOT_DIR)/spec/remove_extra_tags.py sandboxes templates
	openapi-python-client generate --output-path $(ROOT_DIR)/packages/python-sdk/e2b/api/api --overwrite --path $(ROOT_DIR)/spec/openapi_generated.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api
	ruff format .

generate-envd:
	if [ ! -f "/go/bin/protoc-gen-connect-python" ]; then \
		$(MAKE) -C $(ROOT_DIR)/packages/connect-python build; \
	fi

	cd $(ROOT_DIR)/spec/envd && pwd && buf generate --template buf-python.gen.yaml
	./scripts/fix-python-pb.sh

	ruff format .

generate: generate-api generate-envd generate-mcp

init:
	pip install openapi-python-client datamodel-code-generator

lint:
	ruff check .

format:
	ruff format .

generate-mcp:
	datamodel-codegen \
			--input ../../spec/mcp-server.json \
			--input-file-type jsonschema \
			--output e2b/sandbox/mcp.py \
			--output-model-type typing.TypedDict \
			--target-python-version 3.9 \
			--class-name McpServer \
			--use-field-description \
			--disable-timestamp \
			--extra-fields forbid

.PHONY: setup
setup:
	poetry install

.PHONY: test
test: setup
	poetry run pytest --verbose --numprocesses=4
