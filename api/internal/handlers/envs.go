package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	"github.com/devbookhq/orchestration-services/api/pkg/nomad"
	"github.com/devbookhq/orchestration-services/api/pkg/supabase"
	"github.com/gin-gonic/gin"
	"golang.org/x/exp/slices"
)

func (a *APIStore) PostEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.PostEnvsCodeSnippetIDParams,
) {
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	var env api.PostEnvsCodeSnippetIDJSONBody
	if err := c.Bind(&env); err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("stopped request trying to recreate template environment %s", codeSnippetID)
		a.sendAPIStoreError(c, http.StatusBadRequest, "template envs cannot be modified")
		return
	}

	if len(env.Deps) == 0 {
		err := a.nomadClient.UsePrebuiltEnv(codeSnippetID, string(env.Template), func(err *error) {
			if err != nil {
				fmt.Printf("failed to use prebuilt for code snippet %s: %+v", codeSnippetID, err)
			} else {
				updateErr := supabase.UpdateEnvState(a.supabase, codeSnippetID, api.Done)
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

	} else {
		err := a.nomadClient.BuildEnv(codeSnippetID, string(env.Template), env.Deps)
		if err != nil {
			fmt.Printf("error: %v\n", err)
			a.sendAPIStoreError(
				c,
				http.StatusInternalServerError,
				fmt.Sprintf("Failed to create env for code snippet '%s': %s", codeSnippetID, err),
			)
			return
		}
	}

	c.Status(http.StatusNoContent)
}

func (a *APIStore) DeleteEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.DeleteEnvsCodeSnippetIDParams,
) {
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("stopped request trying to delete template environment %s", codeSnippetID)
		a.sendAPIStoreError(c, http.StatusBadRequest, "template envs cannot be modified")
		return
	}

	err = a.supabase.DB.
		From("envs").
		Delete().
		Eq("code_snippet_id", codeSnippetID).
		Execute(nil)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to delete env for code snippet '%s': %s", codeSnippetID, err),
		)
		return
	}

	err = a.nomadClient.DeleteEnv(codeSnippetID)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to delete env for code snippet '%s': %s", codeSnippetID, err),
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
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		a.sendAPIStoreError(c, http.StatusUnauthorized, fmt.Sprintf("Error with API token: %s", keyErr))
		return
	}

	var envStateUpdate api.PutEnvsCodeSnippetIDStateJSONBody
	if err := c.Bind(&envStateUpdate); err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Error when parsing request: %s", err),
		)
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

	err = supabase.UpdateEnvState(a.supabase, codeSnippetID, envStateUpdate.State)
	if err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to update env state for code snippet '%s': %s", codeSnippetID, err),
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
	_, keyErr := a.validateAPIKey(params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("stopped request trying to update template environment %s", codeSnippetID)
		a.sendAPIStoreError(c, http.StatusBadRequest, "template envs cannot be modified")
		return
	}

	session, err := a.sessionsCache.FindEditSession(codeSnippetID)
	if err != nil {
		fmt.Printf("cannot find active edit session for the code snippet '%s': %v - will use saved rootfs", codeSnippetID, err)
	}

	err = a.nomadClient.UpdateEnv(codeSnippetID, session)
	if err != nil {
		fmt.Printf("error: %v\n", err)
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to update env for code snippet '%s': %+v", codeSnippetID, err),
		)
		return
	}

	c.Status(http.StatusNoContent)
}
