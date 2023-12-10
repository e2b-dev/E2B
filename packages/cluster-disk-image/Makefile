GCP_PROJECT ?= $$(gcloud config get-value project)
GCP_ZONE ?= us-central1-c

init:
	packer init -upgrade .

build:
	packer build -var "gcp_project_id=$(GCP_PROJECT)" -var "gcp_zone=$(GCP_ZONE)"  .

format:
	packer fmt .
