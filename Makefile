update-api-spec:
	@echo "Updating API spec"
	@./scripts/update-api-spec.sh
	@echo "Done"


generate:
	cd packages/python-sdk && make generate
	cd packages/js-sdk && pnpm generate
	cd packages/connect-python && make bin/protoc-gen-connect-python
	cd spec && buf generate