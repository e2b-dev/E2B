.PHONY: generate
generate:
	rm -rf ./e2b/api/client
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../spec/openapi.yml  \
	--library asyncio \
	-g python-nextgen \
	-o ./e2b/api \
	--global-property apis,models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=true \
	--additional-properties=packageName=e2b.api.client
	mv ./e2b/api/e2b/api/* ./e2b/api/
	rm -r ./e2b/api/e2b
	rm -r ./e2b/api/client/docs
	rm -r ./e2b/api/client/test
	black .
