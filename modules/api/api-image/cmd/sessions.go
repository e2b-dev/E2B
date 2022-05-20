package main

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/handlers"
	"github.com/gin-gonic/gin"
)

func (p *APIStore) GetSessions(c *gin.Context) {
	sessions, err := p.nomad.GetSessions()

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error listing sessions")
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (p *APIStore) PostSessions(c *gin.Context) {
	var newSession handlers.SessionForm
	if err := c.Bind(&newSession); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	session, err := p.nomad.CreateSession(&newSession)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error creating session")
		return
	}

	p.sessionsCache.Register(session)

	c.JSON(http.StatusCreated, &session)
}

func (p *APIStore) DeleteSessionsSessionId(c *gin.Context, id string) {
	err := p.nomad.DeleteSession(id)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error deleting session")
		return
	}

	c.String(http.StatusOK, "Session delete successful")
}

func (p *APIStore) PutSessionsSessionIdRefresh(c *gin.Context, id string) {
	err := p.nomad.DeleteSession(id)

	if err != nil {
		sendAPIStoreError(c, http.StatusInternalServerError, "Error deleting session")
		return
	}

	p.sessionsCache.Refresh(id)

	c.String(http.StatusOK, "Session re successful")
}
