gcloud-login:
	gcloud auth application-default login
	echo "export GOOGLE_APPLICATION_CREDENTIALS=/home/gitpod/.config/gcloud/application_default_credentials.json" >>  ~/.bashrc