update-api-spec:
	@echo "Updating API spec"
	@./scripts/update-api-spec.sh
	@echo "Done"


generate: generate-api generate-envd

generate-api:
	cd packages/python-sdk && make generate-api
	cd packages/js-sdk && pnpm generate && pnpm generate-envd-api

generate-envd:
	cd packages/js-sdk && pnpm generate-envd-api
	cd spec/envd && buf generate && cd ../../packages/python-sdk && ./scripts/fix-python-pb.sh
