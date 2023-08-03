.PHONY: generate
generate:
	rm -rf ./e2b_sdk/api/client
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../openapi.yml  \
	--library asyncio \
	-g python-nextgen \
	-o ./e2b_sdk/api \
	--global-property apis,models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=true \
	--additional-properties=packageName=client \
	--additional-properties=floatStrictType=false \
	--additional-properties=allowStringInDateTimeParameters=false
	black .
