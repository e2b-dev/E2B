.PHONY: generate-v2
generate-v2:
	mv ./e2b/api/__init__.py ./e2b/api/__init__.py.bck
	rm -rf ./e2b/api/v2
	npx -yes @openapitools/openapi-generator-cli@latest version-manager set 7.1.0
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../spec/openapi.yml  \
	-g python \
	-o ./e2b/api \
	--global-property apis=sandboxes,templates,models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=usePydanticV2=true \
	--additional-properties=packageName=e2b.api.v2.client
	mv ./e2b/api/e2b/api/* ./e2b/api/
	rm -r ./e2b/api/e2b
	rm -r ./e2b/api/v2/client/docs
	rm -r ./e2b/api/v2/client/test
	rm -r ./e2b/api/.openapi-generator
	mv ./e2b/api/__init__.py.bck ./e2b/api/__init__.py
	black .

.PHONY: generate-v1
generate-v1:
	mv ./e2b/api/__init__.py ./e2b/api/__init__.py.bck
	rm -rf ./e2b/api/v1
	npx -yes @openapitools/openapi-generator-cli@latest version-manager set 7.1.0
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../spec/openapi.yml  \
	-g python-pydantic-v1 \
	-o ./e2b/api \
	--global-property apis=sandboxes,templates,models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=packageName=e2b.api.v1.client
	mv ./e2b/api/e2b/api/* ./e2b/api/
	rm -r ./e2b/api/e2b
	rm -r ./e2b/api/v1/client/docs
	rm -r ./e2b/api/v1/client/test
	rm -r ./e2b/api/.openapi-generator
	mv ./e2b/api/__init__.py.bck ./e2b/api/__init__.py
	black .

.PHONY: generate
generate: generate-v1 generate-v2

.PHONY: generate-envd-api-v2
generate-envd-api-v2:
	mv ./e2b/envd/__init__.py ./e2b/envd/__init__.py.bck
	rm -rf ./e2b/envd/v2
	npx -yes @openapitools/openapi-generator-cli@latest version-manager set 7.1.0
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../spec/envd/envd.yaml  \
	-g python \
	-o ./e2b/envd \
	--global-property apis="files",models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=usePydanticV2=true \
	--additional-properties=packageName=e2b.envd.v2.client
	mv ./e2b/envd/e2b/envd/* ./e2b/envd/
	rm -r ./e2b/envd/e2b
	rm -rf ./e2b/envd/v2/client/docs
	rm -rf ./e2b/envd/v2/client/test
	rm -r ./e2b/envd/.openapi-generator
	mv ./e2b/envd/__init__.py.bck ./e2b/envd/__init__.py
	black .

.PHONY: generate-envd-api-v1
generate-envd-api-v1:
	mv ./e2b/envd/__init__.py ./e2b/envd/__init__.py.bck
	rm -rf ./e2b/envd/v1
	npx -yes @openapitools/openapi-generator-cli@latest version-manager set 7.1.0
	npx -yes @openapitools/openapi-generator-cli generate \
	-i ../../spec/envd/envd.yaml  \
	-g python-pydantic-v1 \
	-o ./e2b/envd \
	--global-property apis="files",models,supportingFiles,modelDocs=false \
	--additional-properties=generateSourceCodeOnly=true \
	--additional-properties=disallowAdditionalPropertiesIfNotPresent=false \
	--additional-properties=packageName=e2b.envd.v1.client
	mv ./e2b/envd/e2b/envd/* ./e2b/envd/
	rm -r ./e2b/envd/e2b
	rm -rf ./e2b/envd/v1/client/docs
	rm -rf ./e2b/envd/v1/client/test
	rm -r ./e2b/envd/.openapi-generator
	mv ./e2b/envd/__init__.py.bck ./e2b/envd/__init__.py
	black .

.PHONY: generate-envd-api
generate-envd-api: generate-envd-api-v1 generate-envd-api-v2
