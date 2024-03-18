package constants

import (
	"fmt"
	"strings"
)

func CheckRequired() error {
	var missing []string

	if GCPProject == "" {
		missing = append(missing, "GCP_PROJECT_ID")
	}

	if Domain == "" {
		missing = append(missing, "DOMAIN_NAME")
	}

	if DockerRegistry == "" {
		missing = append(missing, "DOCKER_REGISTRY")
	}

	if GoogleServiceAccountSecret == "" {
		missing = append(missing, "GOOGLE_SERVICE_ACCOUNT_SECRET")
	}

	if GCPRegion == "" {
		missing = append(missing, "GCP_REGION")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing environment variables: %s", strings.Join(missing, ", "))
	}

	return nil
}
