package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/gin-gonic/gin"
)

func (a *APIStore) GetSessions(
	c *gin.Context,
	params api.GetSessionsParams,
) {
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	sessions, err := a.nomadClient.GetSessions()

	if err != nil {
		fmt.Printf("Error when listing sessions: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (a *APIStore) PostSessions(
	c *gin.Context,
	params api.PostSessionsParams,
) {

	var newSession api.PostSessionsJSONBody
	if err := c.Bind(&newSession); err != nil {
		sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	// The default option in the openapi does not automatically populate JSON field with the default value
	if newSession.EditEnabled == nil {
		editEnabled := false
		newSession.EditEnabled = &editEnabled
	}

	if *newSession.EditEnabled {
		_, keyErr := a.validateAPIKey(params.ApiKey)
		if keyErr != nil {
			fmt.Printf("error with API key: %+v", keyErr)
			sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
			return
		}

		existingSession, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)
		if err != nil {
			fmt.Printf("Creating a new edit session because there is no existing edit session: %v\n", err)
		} else {
			c.JSON(http.StatusCreated, &existingSession)
			return
		}
	}

	session, err := a.nomadClient.CreateSession(&newSession)

	if err != nil {
		fmt.Printf("Error when creating: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	if *newSession.EditEnabled {
		// We check for the edit session again because we didn't want to lock for the whole duration of this function.
		// If we find an existing session now we just discard the one we created and everything will work.
		existingSession, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)

		if err != nil {
			fmt.Printf("Creating a new edit session because there is no existing edit session: %v\n", err)
		} else {
			fmt.Printf("Found an another edit session after we created a new editing session. Returning the other session.")

			err = a.nomadClient.DeleteSession(session.SessionID)
			fmt.Printf("Error when cleaning up session: %v\n", err)

			c.JSON(http.StatusCreated, &existingSession)
			return
		}
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

func (a *APIStore) DeleteSessionsSessionID(
	c *gin.Context,
	sessionID string,
	params api.DeleteSessionsSessionIDParams,
) {
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	err := a.nomadClient.DeleteSession(sessionID)

	if err != nil {
		fmt.Printf("Error when deleting session: %v\n", err)
		sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PostSessionsSessionIDRefresh(
	c *gin.Context,
	sessionID string,
	params api.PostSessionsSessionIDRefreshParams,
) {
	err := a.sessionsCache.Refresh(sessionID)
	if err != nil {
		fmt.Printf("Error when refreshing session: %v\n", err)
		msg := fmt.Sprintf("Error refreshing session - session '%s' was not found", sessionID)
		sendAPIStoreError(c, http.StatusNotFound, msg)
		return
	}

	c.Status(http.StatusNoContent)
}
