package handlers

import (
	"github.com/gin-gonic/gin"
)

func (a *APIStore) PostEnvs(
	c *gin.Context,
) {
	// ctx := c.Request.Context()

	// TODO: Add auth

	// body, err := parseBody[api.PostEnvsJSONRequestBody](ctx, c)
	// if err != nil {
	// 	a.sendAPIStoreError(c, http.StatusBadRequest, fmt.Sprintf("Error when parsing request: %s", err))
	// 	return
	// }

	// TODO: Build env + maybe server stream results

	// c.JSON(http.StatusOK, newEnv)
}
