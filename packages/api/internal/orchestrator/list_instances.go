package orchestrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/golang/protobuf/ptypes/empty"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
	"github.com/google/uuid"
)

func (o *Orchestrator) GetInstances(ctx context.Context) ([]*instance.InstanceInfo, error) {
	res, err := o.grpc.Client.SandboxList(ctx, &empty.Empty{})
	if err != nil {
		return nil, err
	}

	if res == nil {
		return nil, fmt.Errorf("failed to get sandboxes")
	}

	instances := make([]*instance.InstanceInfo, 0)

	for _, sbx := range res.GetSandboxes() {
		instanceID := sbx.SandboxID
		envID := sbx.TemplateID
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

		instances = append(instances, &instance.InstanceInfo{
			Instance: &api.Sandbox{
				SandboxID:  instanceID,
				TemplateID: envID,
				Alias:      alias,
				ClientID:   sbx.ClientID,
			},
			BuildID:           buildUUID,
			TeamID:            teamUUID,
			Metadata:          metadata,
			MaxInstanceLength: maxInstanceLength,
		})
	}

	return instances, nil
}
