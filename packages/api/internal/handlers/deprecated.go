package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/shared/pkg/telemetry"
)

// GetEnvs serves to list envs (e.g. in
// CLI)
func (a *APIStore) GetEnvs(c *gin.Context) {
	templates := a.GetTemplatesWithoutResponse(c)
	if templates != nil {
		envs := make([]api.Environment, len(templates))

		for index, template := range templates {
			env := api.Environment{
				EnvID:   template.TemplateID,
				BuildID: template.BuildID,
				Public:  template.Public,
				Aliases: template.Aliases,
			}
			envs[index] = env
		}

		c.JSON(http.StatusOK, envs)
	}
}

// PostEnvs serves to create an env (e.g. in CLI)
func (a *APIStore) PostEnvs(c *gin.Context) {
	template := a.PostTemplatesWithoutResponse(c)
	if template != nil {
		env := &api.Environment{
			EnvID:   template.TemplateID,
			BuildID: template.BuildID,
			Public:  template.Public,
			Aliases: template.Aliases,
		}
		c.JSON(http.StatusCreated, env)
	}
}

// PostEnvsEnvID serves to recreate an env (e.g. in CLI)
func (a *APIStore) PostEnvsEnvID(c *gin.Context, aliasOrEnvID api.EnvID) {
	template := a.PostTemplatesTemplateIDWithoutResponse(c, aliasOrEnvID)

	if template != nil {
		env := &api.Environment{
			EnvID:   template.TemplateID,
			BuildID: template.BuildID,
			Public:  template.Public,
			Aliases: template.Aliases,
		}

		c.JSON(http.StatusOK, env)
	}
}

// GetEnvsEnvIDBuildsBuildID serves to get an env build status (e.g. to CLI)
func (a *APIStore) GetEnvsEnvIDBuildsBuildID(c *gin.Context, envID api.EnvID, buildID api.BuildID, params api.GetEnvsEnvIDBuildsBuildIDParams) {
	paramsTemplate := api.GetTemplatesTemplateIDBuildsBuildIDParams(params)
	result := a.GetTemplatesTemplateIDBuildsBuildIDWithoutResponse(c, envID, buildID, paramsTemplate)

	if result != nil {
		resultEnv := &api.EnvironmentBuild{
			BuildID: result.BuildID,
			EnvID:   result.TemplateID,
			Logs:    result.Logs,
			Status:  (*api.EnvironmentBuildStatus)(result.Status),
		}
		c.JSON(http.StatusOK, *resultEnv)
	}
}

// PostEnvsEnvIDBuildsBuildIDLogs serves to add logs from the Build Driver
func (a *APIStore) PostEnvsEnvIDBuildsBuildIDLogs(c *gin.Context, envID api.EnvID, buildID string) {
	a.PostTemplatesTemplateIDBuildsBuildIDLogs(c, envID, buildID)
}

// DeleteEnvsEnvID serves to delete an env (e.g. in CLI)
func (a *APIStore) DeleteEnvsEnvID(c *gin.Context, aliasOrEnvID api.EnvID) {
	a.DeleteTemplatesTemplateID(c, aliasOrEnvID)
}

// PostInstances serves to create an instance
func (a *APIStore) PostInstances(c *gin.Context) {
	ctx := c.Request.Context()

	body, err := parseBody[api.PostInstancesJSONRequestBody](ctx, c)
	if err != nil {
		a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))

		errMsg := fmt.Errorf("error when parsing request: %w", err)
		telemetry.ReportCriticalError(ctx, errMsg)

		return
	}

	sandbox := a.PostSandboxesWithoutResponse(c, ctx, body.EnvID, (*map[string]string)(body.Metadata))
	if sandbox != nil {
		instance := api.Instance{
			InstanceID: sandbox.SandboxID,
			EnvID:      sandbox.TemplateID,
			ClientID:   sandbox.ClientID,
		}
		c.JSON(http.StatusCreated, &instance)
	}
}

func (a *APIStore) GetInstances(c *gin.Context) {
	sandboxes := a.GetSandboxesWithoutResponse(c)

	instances := make([]api.RunningInstance, len(sandboxes))

	for index, sandbox := range sandboxes {
		instance := api.RunningInstance{
			ClientID:   sandbox.ClientID,
			EnvID:      sandbox.TemplateID,
			InstanceID: sandbox.SandboxID,
			StartedAt:  sandbox.StartedAt,
			Metadata:   nil,
		}

		if sandbox.Metadata != nil {
			meta := api.InstanceMetadata(*sandbox.Metadata)
			instance.Metadata = &meta
		}

		instances[index] = instance
	}

	c.JSON(http.StatusOK, instances)
}

// PostInstancesInstanceIDRefreshes serves to keep an instance alive
func (a *APIStore) PostInstancesInstanceIDRefreshes(c *gin.Context, instanceID string) {
	a.PostSandboxesSandboxIDRefreshes(c, instanceID)
}
