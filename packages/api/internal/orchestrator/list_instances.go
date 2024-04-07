package orchestrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/google/uuid"
)

func (o *Orchestrator) GetInstances(ctx context.Context) ([]*instance.InstanceInfo, error) {
	res, err := o.client.GetSandboxes(ctx)
	if err != nil {
		return nil, err
	}

	if res == nil {
		return nil, fmt.Errorf("failed to get sandboxes")
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get sandboxes: %v", res.Status)
	}

	body, err := utils.ParseJSONBody[[]Sandbox](ctx, res.Body)
	if err != nil {
		return nil, err
	}

	instances := make([]*instance.InstanceInfo, 0)

	for _, sbx := range *body {
		instanceID := sbx.InstanceID
		envID := sbx.EnvID
		buildID := sbx.BuildID
		aliasRaw := sbx.Alias
		teamID := sbx.TeamID
		metadataRaw := sbx.Metadata
		maxInstanceLengthInt := sbx.MaxInstanceLength
		maxInstanceLength := time.Duration(maxInstanceLengthInt) * time.Hour

		var metadata map[string]string

		err = json.Unmarshal([]byte(metadataRaw), &metadata)
		if err != nil {
			fmt.Errorf("failed to unmarshal metadata for job %v", err)
		}

		var teamUUID *uuid.UUID
		var buildUUID *uuid.UUID
		var alias *string

		if teamID != "" {
			parsedTeamID, parseErr := uuid.Parse(teamID)
			if parseErr != nil {
				fmt.Errorf("failed to parse team ID '%s' for job: %v\n", teamID, parseErr)
			} else {
				teamUUID = &parsedTeamID
			}
		}

		if buildID != "" {
			parsedBuildID, parseErr := uuid.Parse(buildID)
			if parseErr != nil {
				fmt.Errorf("failed to parse build ID '%s' for job: %v\n", buildID, err)
			}
			buildUUID = &parsedBuildID
		}

		if aliasRaw != "" {
			alias = &aliasRaw
		}

		var clientID string

		if sbx.ClientID == nil {
			fmt.Errorf("client ID is nil for job %s\n", instanceID)

			clientID = ""
		} else {
			clientID = *sbx.ClientID
		}

		instances = append(instances, &instance.InstanceInfo{
			Instance: &api.Sandbox{
				SandboxID:  instanceID,
				TemplateID: envID,
				Alias:      alias,
				ClientID:   clientID,
			},
			BuildID:           buildUUID,
			TeamID:            teamUUID,
			Metadata:          metadata,
			MaxInstanceLength: maxInstanceLength,
		})
	}

	return instances, nil
}
