-include .env

GCP_PROJECT ?= $$(gcloud config get-value project)
CLOUDFLARE_API_TOKEN ?= empty
IMAGE := e2b-orchestration/api

server := gcloud compute instances list --project=${GCP_PROJECT} --format='csv(name)' | grep "server"
client := gcloud compute instances list --project=${GCP_PROJECT} --format='csv(name)' | grep "client"

tf_vars := TF_VAR_client_machine_type=$(CLIENT_MACHINE_TYPE) \
	TF_VAR_client_cluster_size=$(CLIENT_CLUSTER_SIZE) \
	TF_VAR_server_machine_type=$(SERVER_MACHINE_TYPE) \
	TF_VAR_server_cluster_size=$(SERVER_CLUSTER_SIZE) \
	TF_VAR_gcp_project_id=${GCP_PROJECT} \
	TF_VAR_gcp_region=$(GCP_REGION) \
	TF_VAR_gcp_zone=$(GCP_ZONE) \
	TF_VAR_domain_name=$(DOMAIN_NAME) \
	TF_VAR_cloudflare_api_token=$(CLOUDFLARE_API_TOKEN)


WITHOUT_JOBS := $(shell terraform state list | grep module | cut -d'.' -f1,2 | uniq | grep -v -e "nomad" | awk '{print "-target=" $$0 ""}' | xargs)
DESTROY_TARGETS := $(shell terraform state list | grep module | cut -d'.' -f1,2 | uniq | grep -v -e "fc_envs_disk" -e "buckets" | awk '{print "-target=" $$0 ""}' | xargs)


# Login for Packer and Docker (uses gcloud user creds)
# Login for Terraform (uses application default creds)
.PHONY: login-gcloud
login-gcloud:
	gcloud auth login
	gcloud config set project "${GCP_PROJECT}"
	gcloud --quiet auth configure-docker us-central1-docker.pkg.dev
	gcloud auth application-default login

.PHONY: init
init:
	terraform init -input=false
	$(MAKE) -C packages/cluster-disk-image init
	$(tf_vars) terraform apply -target=module.init -auto-approve -input=false

.PHONY: plan
plan:
	terraform fmt -recursive
	$(tf_vars) \
	terraform plan -compact-warnings -detailed-exitcode

.PHONY: apply
apply:
	$(tf_vars) \
	terraform apply \
	-auto-approve \
	-input=false \
	-compact-warnings \
	-parallelism=20

.PHONY: apply-without-jobs
apply-without-jobs:
	$(tf_vars) \
	terraform apply \
	-auto-approve \
	-input=false \
	-compact-warnings \
	-parallelism=20 \
  	$(WITHOUT_JOBS)

.PHONY: destroy
destroy:
	$(tf_vars) \
	terraform destroy \
	-input=false \
	-compact-warnings \
	-parallelism=20 \
  	$(DESTROY_TARGETS)


.PHONY: version
version:
	./scripts/increment-version.sh

.PHONY: bootstrap-consul
bootstrap-consul:
	gcloud compute ssh $$($(server)) -- \
	'consul acl bootstrap'

.PHONY: bootstrap-nomad
bootstrap-nomad:
	gcloud compute ssh $$($(server)) -- \
	'nomad acl bootstrap'

build-all:
	$(MAKE) -C packages/envd build
	$(MAKE) -C packages/api build
	$(MAKE) -C packages/env-instance-task-driver build
	$(MAKE) -C packages/env-build-task-driver build

build-and-upload-all:
	GCP_PROJECT=${GCP_PROJECT} $(MAKE) -C packages/envd build-and-upload
	GCP_PROJECT=${GCP_PROJECT} make update-api
	GCP_PROJECT=${GCP_PROJECT} $(MAKE) -C packages/env-instance-task-driver build-and-upload
	GCP_PROJECT=${GCP_PROJECT} $(MAKE) -C packages/env-build-task-driver build-and-upload

.PHONY: update-api
update-api:
	docker buildx install # sets up the buildx as default docker builder (otherwise the command below won't work)
	docker build --platform linux/amd64 --tag "$(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE)" --push -f api.Dockerfile .

# Set the size of the fc-envs disk
FC_ENVS_SIZE := 200

resize-fc-envs:
	gcloud --project=$(GCP_PROJECT) compute disks resize fc-envs --size $(FC_ENVS_SIZE) --zone us-central1-a
	gcloud compute ssh $$($(client)) -- 'sudo xfs_growfs -d /dev/sdb'
