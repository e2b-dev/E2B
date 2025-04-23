update-api-spec:
	@echo "Updating API spec"
	@./scripts/update-api-spec.sh
	@echo "Done"

.PHONY: codegen
codegen:
	@echo "Generating SDK code from openapi and envd spec"
	@./scripts/codegen.sh

generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate
	cd packages/js-sdk && pnpm generate-envd-api
	cd spec/envd && buf generate --template buf-js.gen.yaml

# `brew install protobuf` beforehand
generate-python:
	if [ ! -f "/go/bin/protoc-gen-connect-python" ]; then \
		$(MAKE) -C packages/connect-python build; \
	fi
	cd packages/python-sdk && make generate-api
	cd spec/envd && buf generate --template buf-python.gen.yaml
	cd packages/python-sdk && ./scripts/fix-python-pb.sh && black .

.PHONY: init-styles
init-styles:
	vale sync
