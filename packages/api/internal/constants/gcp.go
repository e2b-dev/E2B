package constants

import "os"

var (
	// ProjectID is the GCP project ID
	ProjectID = os.Getenv("GCP_PROJECT_ID")

	// Region is the GCP region
	Region = os.Getenv("GCP_REGION")

	// Zone is the GCP zone
	Zone = os.Getenv("GCP_ZONE")

	// DockerRepositoryName is the name of the artifact registry where the docker images of the built users' dockerfiles are stored
	DockerRepositoryName = os.Getenv("GCP_DOCKER_REPOSITORY_NAME")

	// DockerContextBucketName is the name of the bucket where the docker contexts are stored
	DockerContextBucketName = os.Getenv("GOOGLE_CLOUD_STORAGE_BUCKET")
)
