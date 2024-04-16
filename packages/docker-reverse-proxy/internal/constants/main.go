package constants

import (
	"fmt"
	"strings"

	"github.com/e2b-dev/infra/packages/shared/pkg/consts"
)

func CheckRequired() error {
	var missing []string

	if consts.GCPProject == "" {
		missing = append(missing, "GCP_PROJECT_ID")
	}

	if consts.Domain == "" {
		missing = append(missing, "DOMAIN_NAME")
	}

	if consts.DockerRegistry == "" {
		missing = append(missing, "GCP_DOCKER_REPOSITORY_NAME")
	}

	if consts.GoogleServiceAccountSecret == "" {
		missing = append(missing, "GOOGLE_SERVICE_ACCOUNT_BASE64")
	}

	if consts.GCPRegion == "" {
		missing = append(missing, "GCP_REGION")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing environment variables: %s", strings.Join(missing, ", "))
	}

	return nil
}
