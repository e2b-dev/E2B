generate-api:
	openapi-python-client generate --output-path e2b/api/api --overwrite --path ../../spec/openapi.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api

init:
	pip install openapi-python-client