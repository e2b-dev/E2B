ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

init:
	packer init -upgrade .

build:
	packer build -var "gcp_project_id=$(GCP_PROJECT)" -var "gcp_zone=$(GCP_ZONE)"  .

format:
	packer fmt .
