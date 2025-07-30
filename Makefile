.PHONY: codegen
codegen:
	@echo "Generating SDK code from openapi and envd spec"
	@docker run -v "$$(pwd):/workspace" $$(docker build -q -t codegen-env . -f codegen.Dockerfile)
generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate

generate-python:
	cd packages/python-sdk && make generate

.PHONY: init-styles
init-styles:
	vale sync

