update-api-spec:
	@echo "Updating API spec"
	@./scripts/update-api-spec.sh
	@echo "Done"


generate:
	cd spec && buf generate