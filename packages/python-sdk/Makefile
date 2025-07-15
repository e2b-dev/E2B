generate-api:
	python ./../../spec/remove_extra_tags.py sandboxes
	openapi-python-client generate --output-path e2b/api/api --overwrite --path ../../spec/openapi_generated.yml --config openapi-generator.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api
	mv e2b/api/client/api/sandboxes/get_v2_sandboxes.py e2b/api/compatibility/unused_get_v2_sandboxes.py

init:
	pip install openapi-python-client

lint:
	ruff check .
