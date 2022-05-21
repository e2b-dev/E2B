login-gcloud:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc
	# gcloud auth login

init-infrastructure:
	terraform init -input=false

plan-infrastructure:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

deploy-infrastructure:
	terraform apply -auto-approve -input=false -compact-warnings

build-api-image:
	$(MAKE) -C api build

generate-api-image:
	$(MAKE) -C api generate

init-cluster-image:
	$(MAKE) -C cluster/disk-image init

build-cluster-image:
	$(MAKE) -C cluster/disk-image build

format-cluster-image:
	$(MAKE) -C cluster/disk-image format

publish-mkfcenv-scripts:
	$(MAKE) -C api publish-mkfcenv
