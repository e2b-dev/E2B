package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (a *APIStore) GetSessions(
	c *gin.Context,
	params api.GetSessionsParams,
) {
	ctx := c.Request.Context()

	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		errMsg := fmt.Errorf("error with API key: %+v", keyErr)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}
	a.ReportEvent(ctx, "validated API key")

	sessions, err := a.nomadClient.GetSessions()
	if err != nil {
		errMsg := fmt.Errorf("error when listing sessions: %v", err)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}
	a.ReportEvent(ctx, "listed sessions")

	c.JSON(http.StatusOK, sessions)
}

var postSessionParallelLock = CreateRequestLimitLock(DefaultRequestLimit)

func (a *APIStore) PostSessions(
	c *gin.Context,
	params api.PostSessionsParams,
) {
	ctx := c.Request.Context()
	span := trace.SpanFromContext(ctx)

	a.ReportEvent(ctx, "waiting for parallel lock")
	unlock := postSessionParallelLock()
	defer unlock()
	a.ReportEvent(ctx, "parallel lock passed")

	var newSession api.PostSessionsJSONBody
	if err := c.Bind(&newSession); err != nil {
		errMsg := fmt.Errorf("error when parsing request: %s", err)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}
	a.ReportEvent(ctx, "parsed request")

	// The default option in the openapi does not automatically populate JSON field with the default value
	if newSession.EditEnabled == nil {
		editEnabled := false
		newSession.EditEnabled = &editEnabled
	}

	span.SetAttributes(attribute.Bool("session.edit_enabled", *newSession.EditEnabled))

	if *newSession.EditEnabled {
		_, keyErr := a.validateAPIKey(params.ApiKey)
		if keyErr != nil {
			errMsg := fmt.Errorf("error with API key: %+v", keyErr)
			a.ReportCriticalError(ctx, errMsg)
			a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
			return
		}
		a.ReportEvent(ctx, "validated API key")

		existingSession, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)
		if err != nil {
			a.ReportEvent(ctx, "no existing edit session found")
		} else {
			a.ReportEvent(ctx, "found existing edit session")
			c.JSON(http.StatusCreated, &existingSession)
			return
		}
	}

	session, err := a.nomadClient.CreateSession(&newSession)
	if err != nil {
		errMsg := fmt.Errorf("error when creating: %v", err)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}
	a.ReportEvent(ctx, "created session")

	if *newSession.EditEnabled {
		// We check for the edit session again because we didn't want to lock for the whole duration of this function.
		// If we find an existing session now we just discard the one we created and everything will work.
		existingSession, err := a.sessionsCache.FindEditSession(newSession.CodeSnippetID)
		if err == nil {
			fmt.Printf("Found another edit session after we created a new editing session. Returning the other session.")

			delErr := a.nomadClient.DeleteSession(session.SessionID, true)
			if delErr != nil {
				errMsg := fmt.Errorf("redundant session couldn't be deleted: %v", delErr)
				a.ReportError(ctx, errMsg)
			} else {
				a.ReportEvent(ctx, "deleted redundant session")
			}

			c.JSON(http.StatusCreated, &existingSession)
			return
		}
	}

	if err := a.sessionsCache.Add(session); err != nil {
		errMsg := fmt.Errorf("error when adding session to cache: %v", err)
		a.ReportError(ctx, errMsg)

		delErr := a.nomadClient.DeleteSession(session.SessionID, true)
		if delErr != nil {
			errMsg := fmt.Errorf("couldn't delete session that couldn't be added to cache: %v", delErr)
			a.ReportError(ctx, errMsg)
		} else {
			a.ReportEvent(ctx, "deleted session that couldn't be added to cache")
		}

		a.sendAPIStoreError(c, http.StatusInternalServerError, "Cannot create a session right now")
		return
	}

	c.JSON(http.StatusCreated, &session)
}

func (a *APIStore) DeleteSessionsSessionID(
	c *gin.Context,
	sessionID string,
	params api.DeleteSessionsSessionIDParams,
) {
	ctx := c.Request.Context()
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		errMsg := fmt.Errorf("error with API key: %+v", keyErr)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	err := a.nomadClient.DeleteSession(sessionID, true)
	if err != nil {
		errMsg := fmt.Errorf("error when deleting session: %v", err)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, err.Code, err.ClientMsg)
		return
	}
	a.ReportEvent(ctx, "deleted session")

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PostSessionsSessionIDRefresh(
	c *gin.Context,
	sessionID string,
	params api.PostSessionsSessionIDRefreshParams,
) {
	ctx := c.Request.Context()
	err := a.sessionsCache.Refresh(sessionID)
	if err != nil {
		errMsg := fmt.Errorf("error when refreshing session: %v", err)
		a.ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusNotFound, fmt.Sprintf("Error refreshing session - session '%s' was not found", sessionID))
		return
	}
	a.ReportEvent(ctx, "refreshed session")

	c.Status(http.StatusNoContent)
}
