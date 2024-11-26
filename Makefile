update-api-spec:
	@echo "Updating API spec"
	@./scripts/update-api-spec.sh
	@echo "Done"


generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate
	cd packages/js-sdk && pnpm generate-envd-api
	cd spec/envd && buf generate --template buf-js.gen.yaml

.PHONY: connect-python
generate-python: connect-python
	cd packages/python-sdk && make generate-api
	cd spec/envd && buf generate --template buf-python.gen.yaml
	cd packages/python-sdk && ./scripts/fix-python-pb.sh && black .

.PHONY: init-styles
init-styles:
	vale sync

connect-python:
	$(MAKE) -C packages/connect-python bin/protoc-gen-connect-python
