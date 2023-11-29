package constants

import "os"

var (
	// ProjectID is the GCP project ID
	ProjectID = os.Getenv("GCP_PROJECT_ID")

	// Region is the GCP region
	Region = os.Getenv("GCP_REGION")

	// DockerRepositoryName is the name of the artifact registry where the docker images of the built users' dockerfiles are stored
	DockerRepositoryName = os.Getenv("GCP_DOCKER_REPOSITORY_NAME")
)
