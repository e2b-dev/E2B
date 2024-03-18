package constants

import (
	"encoding/base64"
	"fmt"
	"os"
)

var GCPProject = os.Getenv("GCP_PROJECT_ID")
var Domain = os.Getenv("DOMAIN_NAME")
var DockerRegistry = os.Getenv("GCP_DOCKER_REPOSITORY_NAME")
var GoogleServiceAccountSecret = os.Getenv("GOOGLE_SERVICE_ACCOUNT_BASE64")
var GCPRegion = os.Getenv("GCP_REGION")

var EncodedDockerCredentials = base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("_json_key_base64:%s", GoogleServiceAccountSecret)))
