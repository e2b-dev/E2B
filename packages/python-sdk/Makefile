ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../..)

generate-api:
	python $(ROOT_DIR)/spec/remove_extra_tags.py sandboxes
	openapi-python-client generate --output-path $(ROOT_DIR)/packages/python-sdk/e2b/api/api --overwrite --path $(ROOT_DIR)/spec/openapi_generated.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api
	black .

generate-envd:
	if [ ! -f "/go/bin/protoc-gen-connect-python" ]; then \
		$(MAKE) -C $(ROOT_DIR)/packages/connect-python build; \
	fi

	cd $(ROOT_DIR)/spec/envd && pwd && buf generate --template buf-python.gen.yaml
	./scripts/fix-python-pb.sh

	black .

generate: generate-api generate-envd

init:
	pip install openapi-python-client

lint:
	ruff check .
