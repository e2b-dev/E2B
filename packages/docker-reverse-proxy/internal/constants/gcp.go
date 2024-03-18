package constants

import "os"

var GCPProject = os.Getenv("GCP_PROJECT_ID")
var Domain = os.Getenv("DOMAIN_NAME")
var DockerRegistry = os.Getenv("DOCKER_REGISTRY")
var GoogleServiceAccountSecret = os.Getenv("GOOGLE_SERVICE_ACCOUNT_SECRET")
