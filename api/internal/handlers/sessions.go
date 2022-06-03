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
	if newSession.EditEnabled == nil {
		editEnabled := false
		newSession.EditEnabled = &editEnabled
	}

	if *newSession.EditEnabled {
		a.Lock.Lock()
		session, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)
		if err != nil {
			fmt.Printf("Creating a new edit session because there is no existing edit session: %v\n", err)
		} else {
			c.JSON(http.StatusCreated, &session)
			return
		}
		a.Lock.Unlock()
	}
	
	session, err := a.nomadClient.CreateSession(&newSession)

	if err != nil {
		fmt.Printf("Error when creating: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}
	
	var cacheErr error

	if *newSession.EditEnabled {
		a.Lock.Lock()

		// We check for the edit session again because we didn't want to lock the whole thread.
		// If we find an existing session now we just discard the one we created and everything will work.
		session, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)
		if err != nil {
			fmt.Printf("Creating a new edit session because there is no existing edit session: %v\n", err)
		} else {
			fmt.Printf("Found an another edit session after we created a new editing session. Returning the other session.")
			c.JSON(http.StatusCreated, &session)
			return
		}

		cacheErr = a.sessionsCache.Add(session)
		a.Lock.Unlock()
	}

	if cacheErr != nil {
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
