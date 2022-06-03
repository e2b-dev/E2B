package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) GetSessions(c *gin.Context) {
	sessions, err := a.nomadClient.GetSessions()

	if err != nil {
		fmt.Printf("Error when listing sessions: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (a *APIStore) PostSessions(c *gin.Context) {
	var newSession api.NewSession
	if err := c.Bind(&newSession); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// The default option in the openapi does not automatically populate JSON field witht he default value
	if newSession.SaveFSChanges == nil {
		saveFSChanges := false
		newSession.SaveFSChanges = &saveFSChanges
	}

	session, err := a.nomadClient.CreateSession(&newSession)

	if err != nil {
		fmt.Printf("Error when creating: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	if err := a.sessionsCache.Add(session); err != nil {
		fmt.Printf("Error when adding session to cache: %v\n", err)

		err = a.nomadClient.DeleteSession(session.SessionID)
		fmt.Printf("Error when cleaning up session: %v\n", err)

		sendAPIStoreError(c, http.StatusInternalServerError, "Cannot create a session right now")
		return
	}

	c.JSON(http.StatusCreated, &session)
}

func (a *APIStore) DeleteSessionsSessionID(c *gin.Context, sessionID string) {
	err := a.nomadClient.DeleteSession(sessionID)

	if err != nil {
		fmt.Printf("Error when deleting session: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PutSessionsSessionIDRefresh(c *gin.Context, sessionID string) {
	err := a.sessionsCache.Refresh(sessionID)
	if err != nil {
		fmt.Printf("Error when refreshing session: %v\n", err)
		msg := fmt.Sprintf("Error refreshing session - session '%s' was not found", sessionID)
		sendAPIStoreError(c, http.StatusNotFound, msg)
		return
	}

	c.Status(http.StatusNoContent)
}
