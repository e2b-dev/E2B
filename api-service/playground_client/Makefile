generate:
	rm -rf ./openapi_client
	npx @openapitools/openapi-generator-cli generate \
	-i ../playground/swagger.json  \
	-g python-nextgen \
	-o ./ \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=projectName=playground_client
