package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/constants"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/handlers"
)

func main() {
	ctx := context.Background()

	err := constants.CheckRequired()
	if err != nil {
		log.Fatal(err)
	}

	port := flag.Int("port", 5000, "Port for test HTTP server")
	flag.Parse()

	store := handlers.NewStore(ctx)

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		// Health check for nomad
		if req.URL.Path == "/health" {
			store.HealthCheck(w, req)

			return
		}

		// Docker calls this endpoint to check if the registry needs credentials and to get the url for authentication
		if req.URL.Path == "/v2/" {
			err = store.Login(w, req)
			if err != nil {
				log.Printf("Error while logging in: %s\n", err)
			}
			return
		}

		// Auth endpoint for docker
		if req.URL.Path == "/v2/token" {
			err = store.GetToken(w, req)
			if err != nil {
				log.Printf("Error while getting token: %s\n", err)
			}

			return
		}

		// Proxy all other requests
		store.Proxy(w, req)
	})

	log.Printf("Starting server on port: %d\n", *port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", strconv.Itoa(*port)), nil))
}
