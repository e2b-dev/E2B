package handlers

import (
	"fmt"
	"github.com/e2b-dev/infra/packages/api/internal/constants"
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

func (a *APIStore) GetUserAndTeam(c *gin.Context) (string, string, error) {
	teamID, err := a.GetTeamID(c)
	return a.GetUserID(c), teamID, err
}
