package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
)

func (a *APIStore) Proxy(w http.ResponseWriter, req *http.Request) {
	// Validate the token by checking if the generated token is in the cache
	authHeader := req.Header.Get("Authorization")
	e2bToken := strings.TrimPrefix(authHeader, "Bearer ")

	token, err := a.AuthCache.Get(e2bToken)
	if err != nil {
		fmt.Printf("Error while getting token: %s\n", err)
		w.WriteHeader(http.StatusUnauthorized)

		return
	}

	templateID := token.TemplateID

	// Check if the request is for the correct repository
	path := req.URL.String()
	repoPrefix := fmt.Sprintf("/v2/%s/%s/", constants.GCPProject, constants.DockerRegistry)
	artifactUploadPrefix := fmt.Sprintf("/artifacts-uploads/namespaces/%s/repositories/%s/uploads/", constants.GCPProject, constants.DockerRegistry)

	if strings.HasPrefix(path, repoPrefix) {
		// Uploading blobs doesn't have the template ID in the path
		if !strings.HasPrefix(path, fmt.Sprintf("%spkg/blobs/uploads/", repoPrefix)) {
			pathInRepo := strings.TrimPrefix(path, repoPrefix)
			templateWithBuildID := strings.Split(strings.Split(pathInRepo, "/")[0], ":")

			// If the template ID in the path is different from the token template ID, deny access
			if templateWithBuildID[0] != templateID {
				w.WriteHeader(http.StatusForbidden)
				fmt.Printf("Access denied for template: %s\n", templateID)

				return
			}
		}
	} else if !strings.HasPrefix(path, artifactUploadPrefix) {
		// The request shouldn't need any other endpoints, we deny access
		fmt.Printf("No matching route found for path: %s\n", path)

		w.WriteHeader(http.StatusForbidden)
		return
	}

	// Set the host and access token for the real docker registry
	req.Host = req.URL.Host
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))

	a.proxy.ServeHTTP(w, req)
	return
}
