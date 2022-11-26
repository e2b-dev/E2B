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
	terraform apply -auto-approve -input=false -compact-warnings -parallelism=20

push-api-image:
	$(MAKE) -C packages/api push

init-cluster-image:
	$(MAKE) -C packages/cluster-disk-image init

build-cluster-image:
	$(MAKE) -C packages/cluster-disk-image build

publish-fc-env:
	$(MAKE) -C packages/fc-env publish

build-firecracker-task-driver:
	$(MAKE) -C packages/firecracker-task-driver build

create-tagged-release:
	./scripts/autotag.sh b

push-tagged-release:
	git push && git push --tags

generate-from-openapi:
	$(MAKE) -C packages/api generate
	npm run generate --prefix packages/sdk