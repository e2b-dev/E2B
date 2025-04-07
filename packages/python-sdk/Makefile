generate-api:
	docker run --rm \
	  -v "$(realpath ../../spec):/spec" \
	  -v "$(realpath e2b/api):/e2b/api" \
	  python:3.11-slim bash -c "\
	    pip install pyyaml openapi-python-client && \
	    python /spec/remove_extra_tags.py sandboxes && \
	    openapi-python-client generate --output-path /e2b/api/api --overwrite --path /spec/openapi.yml && \
	    rm -rf /e2b/api/client && \
	    mv /e2b/api/api/e2b_api_client /e2b/api/client && \
	    rm -rf /e2b/api/api"
