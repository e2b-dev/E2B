login-gcloud:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc

init-terraform:
	terraform init -input=false

plan-terraform:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

deploy-terraform: 
	terraform apply -auto-approve -input=false -compact-warnings

build-api-image:
	$(MAKE) -C modules/api/api-image build

generate-api-image:
	$(MAKE) -C modules/api/api-image generate

init-orchestrator-image:
	$(MAKE) -C modules/orchestrator/orchestrator-image init

build-orchestrator-image:
	$(MAKE) -C modules/orchestrator/orchestrator-image build

format-orchestrator-image:
	$(MAKE) -C modules/orchestrator/orchestrator-image format
