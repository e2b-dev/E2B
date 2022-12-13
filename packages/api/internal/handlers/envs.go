package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/devbookhq/devbook-api/packages/api/internal/nomad"
	"github.com/gin-gonic/gin"
	"golang.org/x/exp/slices"
)

func (a *APIStore) GetEnvs(
	c *gin.Context,
	params api.GetEnvsParams,
) {
	ctx := c.Request.Context()

	userID, _, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		errMsg := fmt.Errorf("error with API key: %+v", keyErr)
		ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}
	ReportEvent(ctx, "validated API key")

	// TODO: This and similar queries could be executed as one transaction to the db
	codeSnippets, err := a.supabase.GetCodeSnippets(userID)
	if err != nil {
		fmt.Printf("error getting code snippets from Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}
	c.JSON(http.StatusOK, codeSnippets)
}

func (a *APIStore) PostEnvs(
	c *gin.Context,
	params api.PostEnvsParams,
) {
	userID, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	// TODO: Admin key
	if admin {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Admin key request not supported")
		return
	}

	var env api.PostEnvsJSONRequestBody
	if err := c.Bind(&env); err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	newCodeSnippet, err := a.supabase.CreateCodeSnippet(userID, env.Template, env.Title)
	if err != nil {
		fmt.Printf("error creating code snippet in Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	newEnv, err := a.supabase.CreateEnv(userID, newCodeSnippet.ID, env.Template)
	if err != nil {
		fmt.Printf("error creating env in Supabase: %+v", err)

		err := a.supabase.DeleteCodeSnippet(newCodeSnippet.ID)
		if err != nil {
			fmt.Printf("error deleting code snippet '%s' during cleanup: %+v", newCodeSnippet.ID, err)
		}

		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	buildStartErr := a.nomad.UsePrebuiltEnv(newCodeSnippet.ID, env.Template, func(err *error) {
		if err != nil {
			fmt.Printf("failed to use prebuilt for code snippet '%s' with template '%s': %+v", newCodeSnippet.ID, env.Template, err)
		} else {
			updateErr := a.supabase.UpdateEnvStateCodeSnippet(newCodeSnippet.ID, api.Done)
			if updateErr != nil {
				fmt.Printf("Failed to update env state for code snippet '%s' with template '%s': %+v", newCodeSnippet.ID, env.Template, err)
			}
		}
	})

	if buildStartErr != nil {
		fmt.Printf("error: %v\n", err)
		err := a.supabase.DeleteEnv(newEnv.ID)
		if err != nil {
			fmt.Printf("error deleting failed env in Supabase: %+v", err)
		}
		err = a.supabase.DeleteCodeSnippet(newCodeSnippet.ID)
		if err != nil {
			fmt.Printf("error deleting failed code snippet in Supabase: %+v", err)
		}
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to create code snippet for template '%s': %s", newEnv.ID, err),
		)
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{"id": newCodeSnippet.ID, "template": newCodeSnippet.Template, "title": newCodeSnippet.Title})
}

func (a *APIStore) PostEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.PostEnvsCodeSnippetIDParams,
) {
	userID, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	var env api.PostEnvsCodeSnippetIDJSONRequestBody
	if err := c.Bind(&env); err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	if !admin {
		owner, err := a.isOwner(codeSnippetID, userID)
		if err != nil {
			fmt.Printf("error getting user data from Supabase: %+v", err)
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
			return
		}
		if !owner {
			a.sendAPIStoreError(c, http.StatusUnauthorized, "Unauthorized")
			return
		}
	}

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("stopped request trying to recreate template environment %s", codeSnippetID)
		a.sendAPIStoreError(c, http.StatusBadRequest, "template envs cannot be modified")
		return
	}

	err = a.nomad.UsePrebuiltEnv(codeSnippetID, env.Template, func(err *error) {
		if err != nil {
			fmt.Printf("failed to use prebuilt for code snippet %s: %+v", codeSnippetID, err)
		} else {
			updateErr := a.supabase.UpdateEnvStateCodeSnippet(codeSnippetID, api.Done)
			if updateErr != nil {
				fmt.Printf("Failed to update env state for code snippet '%s': %+v", codeSnippetID, err)
			}
		}
	})
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to create template env for code snippet '%s': %s", codeSnippetID, err),
		)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) DeleteEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.DeleteEnvsCodeSnippetIDParams,
) {
	userID, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	if !admin {
		owner, err := a.isOwner(codeSnippetID, userID)
		if err != nil {
			fmt.Printf("error getting user data from Supabase: %+v", err)
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
			return
		}
		if !owner {
			a.sendAPIStoreError(c, http.StatusUnauthorized, "Unauthorized")
			return
		}
	}

	// TODO: This and similar queries could be executed as one transaction to the db
	err := a.nomad.DeleteEnv(codeSnippetID)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to delete FC env for code snippet '%s': %s", codeSnippetID, err),
		)
		return
	}

	err = a.supabase.DeletePublishedCodeSnippet(codeSnippetID)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to delete published code snippet '%s': %s", codeSnippetID, err),
		)
		return
	}

	err = a.supabase.DeleteEnv(codeSnippetID)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to delete DB env '%s': %s", codeSnippetID, err),
		)
		return
	}

	err = a.supabase.DeleteCodeSnippet(codeSnippetID)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to delete code snippet '%s': %s", codeSnippetID, err),
		)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PutEnvsCodeSnippetIDTitle(
	c *gin.Context,
	codeSnippetID string,
	params api.PutEnvsCodeSnippetIDTitleParams,
) {
	userID, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		a.sendAPIStoreError(c, http.StatusUnauthorized, fmt.Sprintf("Error with API token: %s", keyErr))
		return
	}

	var codeSnippetTitleUpdate api.PutEnvsCodeSnippetIDTitleJSONRequestBody
	if err := c.Bind(&codeSnippetTitleUpdate); err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Error when parsing request: %s", err),
		)
		return
	}

	if !admin {
		owner, err := a.isOwner(codeSnippetID, userID)
		if err != nil {
			fmt.Printf("error getting user data from Supabase: %+v", err)
			a.sendAPIStoreError(c, http.StatusInternalServerError, "Cannot retrieve data")
			return
		}
		if !owner {
			a.sendAPIStoreError(c, http.StatusUnauthorized, "Unauthorized")
			return
		}
	}

	err := a.supabase.UpdateTitleCodeSnippet(codeSnippetID, codeSnippetTitleUpdate.Title)
	if err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to update code snippet title '%s': %s", codeSnippetID, err),
		)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PutEnvsCodeSnippetIDState(
	c *gin.Context,
	codeSnippetID string,
	params api.PutEnvsCodeSnippetIDStateParams,
) {
	_, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		a.sendAPIStoreError(c, http.StatusUnauthorized, fmt.Sprintf("Error with API token: %s", keyErr))
		return
	}

	var envStateUpdate api.PutEnvsCodeSnippetIDStateJSONRequestBody
	if err := c.Bind(&envStateUpdate); err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Error when parsing request: %s", err),
		)
		return
	}

	if !admin {
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("state update is for a template - we will not be updating env in Supabase")
		c.Status(http.StatusNoContent)
		return
	}

	err = a.supabase.UpdateEnvStateCodeSnippet(codeSnippetID, envStateUpdate.State)
	if err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to update env state for '%s': %s", codeSnippetID, err),
		)
		return
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) PatchEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.PatchEnvsCodeSnippetIDParams,
) {
	userID, admin, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	if !admin {
		owner, err := a.isOwner(codeSnippetID, userID)
		if err != nil {
			fmt.Printf("error getting user data from Supabase: %+v", err)
			a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
			return
		}
		if !owner {
			a.sendAPIStoreError(c, http.StatusUnauthorized, "Unauthorized")
			return
		}
	}

	session, err := a.sessionsCache.FindEditSession(codeSnippetID)
	if err != nil {
		fmt.Printf("cannot find active edit session for the code snippet '%s': %v - will use saved rootfs", codeSnippetID, err)
	}

	err = a.nomad.UpdateEnv(codeSnippetID, session)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to update env for code snippet '%s': %+v", codeSnippetID, err),
		)
		return
	}

	_, err = a.supabase.GetPublishedCodeSnippet(codeSnippetID)
	if err != nil {
		fmt.Printf("published code snippet not found, upserting published code snippet for code snippet '%s': %v\n", codeSnippetID, err)

		err = a.supabase.UpsertPublishedCodeSnippet(codeSnippetID)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			a.sendAPIStoreError(
				c,
				http.StatusInternalServerError,
				fmt.Sprintf("Failed to upsert published code snippet '%s': %+v", codeSnippetID, err),
			)
			return
		}
	}

	c.Status(http.StatusNoContent)
}
