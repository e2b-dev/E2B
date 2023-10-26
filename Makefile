-include .env

server := gcloud compute instances list --format='csv(name)' | grep "server"

tf_vars := TF_VAR_client_machine_type=$(CLIENT_MACHINE_TYPE) \
	TF_VAR_client_cluster_size=$(CLIENT_CLUSTER_SIZE) \
	TF_VAR_server_machine_type=$(SERVER_MACHINE_TYPE) \
	TF_VAR_server_cluster_size=$(SERVER_CLUSTER_SIZE)

# Login for Packer and Docker (uses gcloud user creds)
# Login for Terraform (uses application default creds)
.PHONY: login-gcloud
login-gcloud:
	gcloud auth login
	gcloud config set project e2b-prod
	gcloud --quiet auth configure-docker us-central1-docker.pkg.dev
	gcloud auth application-default login

.PHONY: init
init:
	terraform init -input=false
	$(MAKE) -C packages/cluster-disk-image init

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

.PHONY: destroy
destroy:
	$(tf_vars) \
	terraform destroy \
	-input=false \
	-compact-warnings \
	-parallelism=20

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

.PHONY: push-docker
push-docker:
	docker buildx install # sets up the buildx as default docker builder (otherwise the command below won't work)
	docker build --platform linux/amd64 --tag us-central1-docker.pkg.dev/$(GCP_PROJECT)/$(IMAGE) --push -f api.Dockerfile .
