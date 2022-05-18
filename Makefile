login-gcloud:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc

init-infrastructure:
	terraform init -input=false

plan-infrastructure:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

deploy-infrastructure:
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

init-firecracker-task-driver:
	$(MAKE) -C modules/orchestrator/firecracker-task-driver init

build-firecracker-task-driver:
	$(MAKE) -C modules/orchestrator/firecracker-task-driver build

publish-mkfcenv-scripts:
	$(MAKE) -C modules/api/api-image publish-mkfcenv
