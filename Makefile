.PHONY: codegen
codegen:
	@echo "Generating SDK code from openapi and envd spec"
	@CODEGEN_IMAGE=$${CODEGEN_IMAGE:-$$(docker build -q -t codegen-env . -f codegen.Dockerfile)} ; \
	echo "Using codegen image: $$CODEGEN_IMAGE" \
	&& docker run -v $$PWD:/workspace $$CODEGEN_IMAGE make generate

generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate

generate-python:
	cd packages/python-sdk && make generate

.PHONY: init-styles
init-styles:
	vale sync

