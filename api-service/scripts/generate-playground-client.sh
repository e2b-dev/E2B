cd playground && yarn build
cd ..
rm -rf ./playground_client/openapi_client
npx @openapitools/openapi-generator-cli generate -i playground/swagger.json -g python-nextgen -o ./playground_client/ --additional-properties=generateSourceCodeOnly=true --additional-properties=disallowAdditionalPropertiesIfNotPresent=false
