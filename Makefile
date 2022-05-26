# Login for Terraform (uses application default creds)
login-gcloud:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc

# Login for Packer and Docker (uses gcloud user creds)
login-gcloud-user:
	gcloud auth login
	gcloud config set project devbookhq
	gcloud --quiet auth configure-docker us-central1-docker.pkg.dev

init-infrastructure:
	terraform init -input=false

plan-infrastructure:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

deploy-infrastructure:
	terraform apply -auto-approve -input=false -compact-warnings

push-api-image:
	$(MAKE) -C api push

generate-api-image:
	$(MAKE) -C api generate

init-cluster-image:
	$(MAKE) -C cluster/disk-image init

build-cluster-image:
	$(MAKE) -C cluster/disk-image build

format-cluster-image:
	$(MAKE) -C cluster/disk-image format
