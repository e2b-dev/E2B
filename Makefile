# Login for Terraform (uses application default creds)
.PHONY: login-gcloud
login-gcloud:
	gcloud auth application-default login

# Login for Packer and Docker (uses gcloud user creds)
.PHONY: login-gcloud-user
login-gcloud-user:
	gcloud auth login
	gcloud config set project e2b-prod
	gcloud --quiet auth configure-docker us-central1-docker.pkg.dev

.PHONY: init
init:
	terraform init -input=false

.PHONY: plan
plan:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

.PHONY: apply
apply:
	terraform apply -auto-approve -input=false -compact-warnings -parallelism=20

.PHONY: generate-from-openapi
generate-from-openapi:
	$(MAKE) -C packages/api generate

.PHONY: increment-version
increment-version:
	./scripts/increment-version.sh

.PHONY: init-styles
init-styles:
	vale sync
