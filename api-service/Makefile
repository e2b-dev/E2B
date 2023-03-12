generate-playground-client:
	rm -rf ./playground_client
	npx @openapitools/openapi-generator-cli generate \
	-i ./playground/swagger.json  \
	-g python-nextgen \
	-o ./ \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=packageName=playground_client \
	--additional-properties=floatStrictType=false \
	--additional-properties=allowStringInDateTimeParameters=true
