CURRENT_ENV := $(shell cat .last_used_env)
-include .env.${CURRENT_ENV}


PRINT = @echo -e "\e[1;34mBuilding $<\e[0m"

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
	TF_VAR_cloudflare_api_token=$(CLOUDFLARE_API_TOKEN) \
	TF_VAR_prefix=$(PREFIX) \
	TF_VAR_terraform_state_bucket=$(TERRAFORM_STATE_BUCKET) \

ifeq ($(EXCLUDE_GITHUB),1)
	ALL_MODULES := $(shell cat main.tf | grep "^module" | awk '{print $$2}' | grep -v -e "github_tf")
else
	ALL_MODULES := $(shell cat main.tf | grep "^module" | awk '{print $$2}')
endif

WITHOUT_JOBS := $(shell echo $(ALL_MODULES) | tr ' ' '\n' | grep -v -e "nomad" | awk '{print "-target=module." $$0 ""}' | xargs)
ALL_MODULES_ARGS := $(shell echo $(ALL_MODULES) | tr ' ' '\n' | awk '{print "-target=module." $$0 ""}' | xargs)

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
	@ printf "Initializing Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	terraform init -input=false
	$(MAKE) -C packages/cluster-disk-image init
	$(tf_vars) terraform apply -target=module.init -target=module.buckets -auto-approve -input=false -compact-warnings

.PHONY: plan
plan:
	@ printf "Planning Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	terraform fmt -recursive
	$(tf_vars) terraform plan -compact-warnings -detailed-exitcode $(ALL_MODULES_ARGS)

.PHONY: apply
apply:
	@ printf "Applying Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	$(tf_vars) \
	terraform apply \
	-auto-approve \
	-input=false \
	-compact-warnings \
	-parallelism=20 \
	$(ALL_MODULES_ARGS)

.PHONY: plan-without-jobs
plan-without-jobs:
	@ printf "Planning Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	$(tf_vars) \
	terraform plan \
	-input=false \
	-compact-warnings \
	-parallelism=20 \
  	$(WITHOUT_JOBS)

.PHONY: apply-without-jobs
apply-without-jobs:
	@ printf "Applying Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	$(tf_vars) \
	terraform apply \
	-auto-approve \
	-input=false \
	-compact-warnings \
	-parallelism=20 \
  	$(WITHOUT_JOBS)

.PHONY: destroy
destroy:
	@ printf "Destroying Terraform for env: `tput setaf 2``tput bold`$(CURRENT_ENV)`tput sgr0`\n\n"
	DESTROY_TARGETS := $(shell terraform state list | grep module | cut -d'.' -f1,2 | grep -v -e "fc_envs_disk" -e "buckets" | uniq | awk '{print "-target=" $$0 ""}' | xargs)
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

.PHONY: build-all
build-all:
	$(MAKE) -C packages/envd build
	$(MAKE) -C packages/api build
	$(MAKE) -C packages/env-instance-task-driver build
	$(MAKE) -C packages/env-build-task-driver build

.PHONY: build-and-upload-all
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

.PHONE: resize-fc-envs
resize-fc-envs:
	gcloud --project=$(GCP_PROJECT) compute disks resize fc-envs --size $(FC_ENVS_SIZE) --zone us-central1-a
	gcloud compute ssh $$($(client)) -- 'sudo xfs_growfs -d /dev/sdb'

.PHONY: switch-env
switch-env:
	@ touch .last_used_env
	@ printf "Switching from `tput setaf 1``tput bold`$(CURRENT_ENV)`tput sgr0` to `tput setaf 2``tput bold`$(ENV)`tput sgr0`\n\n"
	@ echo $(ENV) > .last_used_env
	@ . .env.${ENV}
	terraform init -input=false -reconfigure -backend-config="bucket=${TERRAFORM_STATE_BUCKET}"
