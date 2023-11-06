package handlers

import (
	"fmt"

	"github.com/e2b-dev/infra/packages/api/internal/constants"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent"

	"github.com/gin-gonic/gin"
)

func (a *APIStore) GetUserID(c *gin.Context) string {
	return c.Value(constants.UserIDContextKey).(string)
}

func (a *APIStore) GetTeamID(c *gin.Context) (string, error) {
	userID := a.GetUserID(c)

	teamID, err := a.supabase.GetDefaultTeamFromUserID(userID)
	if err != nil {
		return "", fmt.Errorf("error when getting default team: %w", err)
	}

	return teamID, nil
}

func (a *APIStore) GetTeam(c *gin.Context) (*ent.Team, error) {
	userID := a.GetUserID(c)

	team, err := a.supabase.GetDefaultTeamAndTierFromUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("error when getting default team: %w", err)
	}

	return team, nil
}

func (a *APIStore) GetUserAndTeam(c *gin.Context) (string, string, *ent.Tier, error) {
	team, err := a.GetTeam(c)

	return a.GetUserID(c), team.ID.String(), team.Edges.Tier, err
}
