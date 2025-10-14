.PHONY: codegen
codegen:
	@echo "Building codegen image"
	docker build -q -t codegen-env . -f codegen.Dockerfile
	@echo "Generating code"
	docker run -v $$PWD:/workspace codegen-env make generate

generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate

generate-python:
	cd packages/python-sdk && make generate

.PHONY: init-styles
init-styles:
	vale sync

