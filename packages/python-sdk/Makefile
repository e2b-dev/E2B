.PHONY: generate
generate:
	rm -rf ./e2b/api/client
	# Waiting for https://github.com/OpenAPITools/openapi-generator/pull/16655 to be merged
	# Using this branch to use pydantic v2: https://github.com/fa0311/openapi-generator/tree/oshmoun-master-2
	# After released, use npx -yes @openapitools/openapi-generator-cli generate
	java -jar /Users/i/Work/e2b/openapi-generator/modules/openapi-generator-cli/target/openapi-generator-cli.jar generate \
	-i ../../spec/openapi.yml  \
	--library asyncio \
	-g python \
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
	echo "You have to change `from_dict` method in `e2b/api/client/models/session.py`. Instead of parsing the results from dict, just pass the dict. (`_obj = Session.parse_obj(obj)`)"
