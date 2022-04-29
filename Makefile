gcloud-login:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc

# Get Terraform modules definitions
get:
	terraform get

init:
	terraform init

plan:
	terraform fmt -check
	terraform plan

deploy: 
	terraform apply -auto-approve
