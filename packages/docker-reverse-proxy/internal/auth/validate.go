package auth

import (
	"context"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envbuild"

	"github.com/e2b-dev/infra/packages/shared/pkg/models"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/accesstoken"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/user"
)

func Validate(ctx context.Context, db *models.Client, token, envID string) (bool, error) {
	u, err := db.User.Query().Where(user.HasAccessTokensWith(accesstoken.ID(token))).WithTeams().Only(ctx)
	if err != nil {
		return false, err
	}

	e, err := db.Env.Query().Where(
		env.ID(envID),
		env.HasBuildsWith(envbuild.StatusEQ(envbuild.StatusWaiting)),
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
