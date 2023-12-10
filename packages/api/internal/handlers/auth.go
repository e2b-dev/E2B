package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
)

func (a *APIStore) GetUserID(c *gin.Context) uuid.UUID {
	return c.Value(constants.UserIDContextKey).(uuid.UUID)
}

func (a *APIStore) GetTeam(c *gin.Context) (*models.Team, error) {
	ctx := c.Request.Context()

	userID := a.GetUserID(c)

	team, err := a.supabase.GetDefaultTeamAndTierFromUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("error when getting default team: %w", err)
	}

	return team, nil
}

func (a *APIStore) GetUserAndTeam(c *gin.Context) (userID uuid.UUID, team *models.Team, tier *models.Tier, err error) {
	team, err = a.GetTeam(c)

	return a.GetUserID(c), team, team.Edges.TeamTier, err
}
