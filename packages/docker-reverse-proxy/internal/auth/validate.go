package auth

import (
	"context"

	"github.com/google/uuid"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/accesstoken"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/predicate"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/user"
)

func Validate(ctx context.Context, db *models.Client, token, envID string, buildID *string) (bool, error) {
	u, err := db.User.Query().Where(user.HasAccessTokensWith(accesstoken.ID(token))).WithTeams().Only(ctx)
	if err != nil {
		return false, err
	}

	whereStatement := []predicate.EnvBuild{envbuild.StatusEQ(envbuild.StatusWaiting)}

	if buildID != nil {
		buildUUID, err := uuid.Parse(*buildID)
		if err != nil {
			return false, err
		}

		whereStatement = append(whereStatement, envbuild.ID(buildUUID))
	}
	e, err := db.Env.Query().Where(
		env.ID(envID),
		env.HasBuildsWith(
			whereStatement...,
		),
	).Only(ctx)
	if err != nil {
		return false, err
	}

	for _, team := range u.Edges.Teams {
		if team.ID == e.TeamID {
			return true, nil
		}
	}

	return false, nil
}
