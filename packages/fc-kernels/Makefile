ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

build:
	./build.sh
upload:
	./upload.sh $(GCP_PROJECT_ID)
