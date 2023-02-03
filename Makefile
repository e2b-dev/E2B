# Login for Terraform (uses application default creds) (Gitpod only)
login-gcloud:
	gcloud auth application-default login
	# echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/codespace/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc

# Login for Packer and Docker (uses gcloud user creds)
login-gcloud-user:
	gcloud auth login
	gcloud config set project devbookhq
	gcloud --quiet auth configure-docker us-central1-docker.pkg.dev

init:
	terraform init -input=false

plan:
	terraform fmt -recursive
	terraform plan -compact-warnings -detailed-exitcode

apply:
	terraform apply -auto-approve -input=false -compact-warnings -parallelism=20

generate-from-openapi:
	$(MAKE) -C packages/api generate
	npm run generate --prefix packages/sdk

increment-version:
	./scripts/increment-version.sh

init-styles:
	vale sync
