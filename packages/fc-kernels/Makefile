ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

.PHONY: build
build:
	./build.sh

.PHONY: upload
upload:
	./upload.sh $(GCP_PROJECT_ID)

.PHONY: build-and-upload
build-and-upload: build upload
