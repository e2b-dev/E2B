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
	go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
	go install honnef.co/go/tools/cmd/staticcheck@latest
	go install github.com/goreleaser/goreleaser@latest
	$(MAKE) -C packages/cluster-disk-image init

.PHONY: plan
plan:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

.PHONY: apply
apply:
	terraform apply -auto-approve -input=false -compact-warnings -parallelism=20

.PHONY: version
version:
	./scripts/increment-version.sh