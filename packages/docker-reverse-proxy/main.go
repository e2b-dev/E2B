package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/handlers"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// TODO: Rewrite all hardcoded strings to constants / variables
// TODO: Remove debug transport
// TODO: Check default values for Proxy, maybe increase some values
// TODO: Supabase RLS for builds
// TODO: Only one in status building - if building -> return the same build ID

func main() {
	ctx := context.Background()

	if constants.GCPProject == "" {
		log.Fatal("GCP_PROJECT_ID is not set")
	}
	if constants.Domain == "" {
		log.Fatal("DOMAIN_NAME is not set")
	}
	if constants.DockerRegistry == "" {
		log.Fatal("DOCKER_REGISTRY is not set")
	}
	if constants.GoogleServiceAccountSecret == "" {
		log.Fatal("GOOGLE_SERVICE_ACCOUNT_SECRET is not set")
	}

	port := flag.Int("port", 5000, "Port for test HTTP server")
	flag.Parse()

	store := handlers.NewStore(ctx)

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if req.URL.Path == "/v2/" {
			if req.Header.Get("Authorization") == "" {
				w.Header().Set("Www-Authenticate", fmt.Sprintf("Bearer realm=\"https://docker.%s/v2/token\"", constants.Domain))
				w.WriteHeader(http.StatusUnauthorized)

				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		if req.URL.Path == "/v2/token" {
			err := store.GetToken(w, req)
			if err != nil {
				fmt.Printf("Error: %s\n", err)
			}

			return
		}

		authHeader := req.Header.Get("Authorization")
		accessToken := strings.TrimPrefix(authHeader, "Bearer ")

		fmt.Printf("Access token: %s\n", accessToken)
		token, err := store.AuthCache.Get(accessToken)
		if err != nil {
			fmt.Printf("Error: %s\n", err)
			w.WriteHeader(http.StatusUnauthorized)

			return
		}

		envID := token.EnvID

		path := req.URL.String()
		if strings.HasPrefix(path, fmt.Sprintf("/v2/%s/%s/", constants.GCPProject, constants.DockerRegistry)) {
			if !strings.HasPrefix(path, fmt.Sprintf("/v2/%s/%s/pkg/blobs/uploads/", constants.GCPProject, constants.DockerRegistry)) {
				pathInRepo := strings.TrimPrefix(path, fmt.Sprintf("/v2/%s/%s/", constants.GCPProject, constants.DockerRegistry))
				envWithBuildID := strings.Split(strings.Split(pathInRepo, "/")[0], ":")

				if envWithBuildID[0] != envID {
					fmt.Printf("Access denied\n")
					w.WriteHeader(http.StatusForbidden)
					return
				}
			}
		} else if !strings.HasPrefix(path, fmt.Sprintf("/artifacts-uploads/namespaces/%s/repositories/%s/uploads/", constants.GCPProject, constants.DockerRegistry)) {

			fmt.Printf("No matching route found for path: %s\n", path)
			w.WriteHeader(http.StatusNotFound) // 404 for no matching route found
			return
		}
		req.Host = req.URL.Host
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))

		store.Proxy.ServeHTTP(w, req)
		return

	})

	fmt.Printf("Starting server on port: %d\n", *port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", strconv.Itoa(*port)), nil))
}
