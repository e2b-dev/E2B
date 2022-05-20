package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/api"
	"github.com/gin-gonic/gin"
)

func (p *APIStore) GetSessions(c *gin.Context) {
	sessions, err := p.nomad.GetSessions()

	if err != nil {
		fmt.Printf("Error in listing sessions: %v", err)
		sendAPIStoreError(c, http.StatusInternalServerError, "Error listing sessions")
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (p *APIStore) PostSessions(c *gin.Context) {
	var newSession api.NewSession
	if err := c.Bind(&newSession); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	session, err := p.nomad.CreateSession(&newSession)

	if err != nil {
		fmt.Printf("Error in creating: %v", err)
		sendAPIStoreError(c, http.StatusInternalServerError, "Error creating session")
		return
	}

	p.sessionsCache.Register(session)

	c.JSON(http.StatusCreated, &session)
}

func (p *APIStore) DeleteSessionsSessionID(c *gin.Context, sessionID string) {
	err := p.nomad.DeleteSession(sessionID)

	if err != nil {
		fmt.Printf("Error deleting session: %v", err)
		sendAPIStoreError(c, http.StatusInternalServerError, "Error deleting session")
		return
	}

	c.Status(http.StatusNoContent)
}

func (p *APIStore) PutSessionsSessionIDRefresh(c *gin.Context, sessionID string) {
	err := p.sessionsCache.Refresh(sessionID)
	if err != nil {
		fmt.Printf("Error in refreshing session: %v", err)
		msg := fmt.Sprintf("Error refreshing session - session '%s' was not found", sessionID)
		sendAPIStoreError(c, http.StatusNotFound, msg)
		return
	}

	c.Status(http.StatusNoContent)
}
