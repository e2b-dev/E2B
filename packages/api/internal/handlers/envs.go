package handlers

import (
	"fmt"
	"net/http"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	"github.com/devbookhq/devbook-api/packages/api/pkg/nomad"
	"github.com/gin-gonic/gin"
	"golang.org/x/exp/slices"
)

func (a *APIStore) GetEnvs(
	c *gin.Context,
	params api.GetEnvsParams,
) {
	ctx := c.Request.Context()

	userID, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		errMsg := fmt.Errorf("error with API key: %+v", keyErr)
		ReportCriticalError(ctx, errMsg)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}
	ReportEvent(ctx, "validated API key")

	// TODO: Admin key
	if userID == nil {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Admin key request not supported")
		return
	}

	codeSnippets, err := a.supabase.GetCodeSnippets(*userID)
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
	userID, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	// TODO: Admin key
	if userID == nil {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Admin key request not supported")
		return
	}

	var env api.PostEnvsJSONRequestBody
	if err := c.Bind(&env); err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
		return
	}

	var template string
	maybeTemplate, err := env.Template.AsTemplate()
	if err == nil {
		template = string(maybeTemplate)
	} else {
		maybeTemplate, err := env.Template.AsNewEnvironmentTemplate1()
		if err == nil {
			template = maybeTemplate
		} else {
			fmt.Printf("error: %v\n", err)
			a.sendAPIStoreError(
				c,
				http.StatusInternalServerError,
				fmt.Sprintf("Failed to parse template'%s': %s", env.Template, err),
			)
			return
		}
	}

	envID, err := a.supabase.CreateEnv(*userID, template)
	if err != nil {
		fmt.Printf("error creating env in Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	codeSnippetID, err := a.supabase.CreateCodeSnippet(*userID, template)
	if err != nil {
		fmt.Printf("error creating code snippet in Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	buildStartErr := a.nomad.UsePrebuiltEnv(codeSnippetID, string(template), func(err *error) {
		if err != nil {
			fmt.Printf("failed to use prebuilt for code snippet '%s' with template '%s': %+v", codeSnippetID, template, err)
		} else {
			updateErr := a.supabase.UpdateEnvStateCodeSnippet(codeSnippetID, api.Done)
			if updateErr != nil {
				fmt.Printf("Failed to update env state for code snippet '%s' with template '%s': %+v", codeSnippetID, template, err)
			}
		}
	})

	if buildStartErr != nil {
		fmt.Printf("error: %v\n", err)
		err := a.supabase.DeleteEnv(envID)
		if err != nil {
			fmt.Printf("error deleting failed env in Supabase: %+v", err)
		}
		err = a.supabase.DeleteCodeSnippet(codeSnippetID)
		if err != nil {
			fmt.Printf("error deleting failed code snippet in Supabase: %+v", err)
		}
		a.sendAPIStoreError(
			c,
			http.StatusInternalServerError,
			fmt.Sprintf("Failed to create code snippet for template '%s': %s", envID, err),
		)
		return
	}

	newEnv := map[string]interface{}{"id": codeSnippetID, "template": template}

	c.JSON(http.StatusOK, newEnv)
}

func (a *APIStore) PostEnvsCodeSnippetID(
	c *gin.Context,
	codeSnippetID string,
	params api.PostEnvsCodeSnippetIDParams,
) {
	_, keyErr := a.validateAPIKey(&params.ApiKey)
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

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetID) {
		fmt.Printf("stopped request trying to recreate template environment %s", codeSnippetID)
		a.sendAPIStoreError(c, http.StatusBadRequest, "template envs cannot be modified")
		return
	}

	var template string

	maybeTemplate, err := env.Template.AsTemplate()
	if err == nil {
		template = string(maybeTemplate)
	} else {
		maybeTemplate, err := env.Template.AsNewEnvironmentTemplate1()
		if err == nil {
			template = maybeTemplate
		} else {
			fmt.Printf("error: %v\n", err)
			a.sendAPIStoreError(
				c,
				http.StatusInternalServerError,
				fmt.Sprintf("Failed to parse template'%s': %s", env.Template, err),
			)
			return
		}
	}

	err = a.nomad.UsePrebuiltEnv(codeSnippetID, string(template), func(err *error) {
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
	userID, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	// TODO: Admin key
	if userID == nil {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Admin key request not supported")
		return
	}

	codeSnippets, err := a.supabase.GetCodeSnippets(*userID)
	if err != nil {
		fmt.Printf("error getting code snippets from Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	found := false
	for _, v := range *codeSnippets {
		if v.ID == codeSnippetID {
			found = true
		}
	}

	if !found {
		fmt.Printf("user '%s' cannot access code snippet '%s'", *userID, codeSnippetID)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Cannot retrieve data")
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

	err = a.nomad.DeleteEnv(codeSnippetID)
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
	codeSnippetIDorEnvID string,
	params api.PutEnvsCodeSnippetIDStateParams,
) {
	_, keyErr := a.validateAPIKey(&params.ApiKey)
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

	templates, err := nomad.GetTemplates()
	if err != nil {
		fmt.Printf("error retrieving templates: %+v\n", err)
	} else if slices.Contains(*templates, codeSnippetIDorEnvID) {
		fmt.Printf("state update is for a template - we will not be updating env in Supabase")
		c.Status(http.StatusNoContent)
		return
	}

	err = a.supabase.UpdateEnvStateCodeSnippet(codeSnippetIDorEnvID, envStateUpdate.State)
	if err != nil {
		a.sendAPIStoreError(
			c,
			http.StatusBadRequest,
			fmt.Sprintf("Failed to update env state for '%s': %s", codeSnippetIDorEnvID, err),
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
	userID, keyErr := a.validateAPIKey(&params.ApiKey)
	if keyErr != nil {
		fmt.Printf("error with API key: %+v", keyErr)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Error with API token")
		return
	}

	// TODO: Admin key
	if userID == nil {
		a.sendAPIStoreError(c, http.StatusNotImplemented, "Admin key request not supported")
		return
	}

	codeSnippets, err := a.supabase.GetCodeSnippets(*userID)
	if err != nil {
		fmt.Printf("error getting code snippets from Supabase: %+v", err)
		a.sendAPIStoreError(c, http.StatusInternalServerError, fmt.Sprintf("Cannot retrieve data: %s", err))
		return
	}

	found := false
	for _, v := range *codeSnippets {
		if v.ID == codeSnippetID {
			found = true
		}
	}

	if !found {
		fmt.Printf("user '%s' cannot access code snippet '%s'", *userID, codeSnippetID)
		a.sendAPIStoreError(c, http.StatusUnauthorized, "Cannot retrieve data")
		return
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

	c.Status(http.StatusNoContent)
}
