package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/e2b-dev/infra/packages/api/internal/auth"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
)

func (a *APIStore) GetUserID(c *gin.Context) uuid.UUID {
	return c.Value(auth.UserIDContextKey).(uuid.UUID)
}

func (a *APIStore) GetTeam(c *gin.Context) (*models.Team, error) {
	ctx := c.Request.Context()

	userID := a.GetUserID(c)

	team, err := a.db.GetDefaultTeamAndTierFromUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("error when getting default team: %w", err)
	}

	return team, nil
}

func (a *APIStore) GetUserAndTeam(c *gin.Context) (*uuid.UUID, *models.Team, *models.Tier, error) {
	team, err := a.GetTeam(c)
	if err != nil {
		return nil, nil, nil, err
	}

	userID := a.GetUserID(c)
	return &userID, team, team.Edges.TeamTier, err
}
