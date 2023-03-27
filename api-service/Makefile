generate-playground-client:
	yarn --cwd ./playground generate
	rm -rf ./playground_client
	npx @openapitools/openapi-generator-cli generate \
	-i ./playground/swagger.json  \
	-g python-nextgen \
	-o ./ \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=true \
	--additional-properties=packageName=playground_client \
	--additional-properties=floatStrictType=false \
	--additional-properties=library=asyncio \
	--additional-properties=allowStringInDateTimeParameters=false
