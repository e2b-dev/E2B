generate-api:
	python ./../../spec/remove_extra_tags.py sandboxes
	openapi-python-client generate --output-path e2b/api/api --overwrite --path ../../spec/openapi_generated.yml
	rm -rf e2b/api/client
	mv e2b/api/api/e2b_api_client e2b/api/client
	rm -rf e2b/api/api
	black .

generate-envd:
	if [ ! -f "/go/bin/protoc-gen-connect-python" ]; then \
		$(MAKE) -C packages/connect-python build; \
	fi

	cd ./../../spec/envd && buf generate --template buf-python.gen.yaml
	black .

generate: generate-api generate-envd
	./scripts/fix-python-pb.sh
	black .

init:
	pip install openapi-python-client

lint:
	ruff check .
