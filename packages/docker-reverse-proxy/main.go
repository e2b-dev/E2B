package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/e2b-dev/infra/packages/docker-reverse-proxy/internal/auth"
	"github.com/e2b-dev/infra/packages/shared/pkg/db"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// TODO: Rewrite all hardcoded strings to constants / variables
// TODO: Remove debug transport
// TODO: Check default values for Proxy, maybe increase some values

type DebugTransport struct{}

func (DebugTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	b, err := httputil.DumpRequestOut(r, false)
	if err != nil {
		return nil, err
	}
	fmt.Println(string(b))
	res, err := http.DefaultTransport.RoundTrip(r)
	if err != nil {
		fmt.Printf("Error: %s\n", err)
	}
	fmt.Printf("Response header: %+v\n", res.Header)
	fmt.Printf("Response status: %+v\n", res.Status)
	fmt.Printf("Request header: %+v\n", res.Request.Header)
	return res, err
}

func main() {
	ctx := context.Background()

	token, err := getToken()
	if err != nil {
		log.Fatal(err)
	}

	database, err := db.NewClient(ctx)
	if err != nil {
		log.Fatal(err)
	}

	port := flag.Int("port", 5000, "Port for test HTTP server")
	flag.Parse()

	targetUrl := &url.URL{
		Scheme: "https",
		Host:   "us-central1-docker.pkg.dev",
	}
	proxy := httputil.NewSingleHostReverseProxy(targetUrl)
	proxy.Transport = DebugTransport{}

	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if req.URL.Path == "/v2/" {
			if req.Header.Get("Authorization") == "" {
				w.Header().Set("Www-Authenticate", "Bearer realm=\"https://docker.e2b-staging.com/v2/token\"")
				w.WriteHeader(http.StatusUnauthorized)

				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		if req.URL.Path == "/v2/token" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(fmt.Sprintf(`{"token": "%s", "expires_in": 360000}`, strings.TrimPrefix(req.Header.Get("Authorization"), "Basic "))))
			return
		}

		path := req.URL.String()
		if strings.HasPrefix(path, "/v2/e2b-dev/e2b-orchestration/") {
			fmt.Printf("\n\nHeaders: %+v\n", req.Header)
			fmt.Printf("Body: %+v\n", req.Body)

			fmt.Printf("Path: %s\n", path)

			splitted := strings.Split(strings.TrimPrefix(path, "/v2/e2b-dev/e2b-orchestration/"), "/")
			fmt.Printf("Splitted: %s\n", splitted)
			envID := splitted[0]
			accessTokenBase64 := req.Header.Get("Authorization")
			fmt.Printf("AccessTokenBase64: %s\n", accessTokenBase64)

			accessTokenBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(accessTokenBase64, "Bearer "))
			if err != nil {
				fmt.Printf("Error: %s\n", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			accessToken := strings.TrimPrefix(string(accessTokenBytes), "_e2b_access_token:")

			fmt.Printf("EnvID: %s\n", envID)
			fmt.Printf("AccessToken: %s\n", accessToken)

			hasAccess, err := auth.Validate(ctx, database.Client, accessToken, envID)
			if err != nil {
				fmt.Printf("Error: %s\n", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			if !hasAccess {
				fmt.Printf("Access denied\n")
				w.WriteHeader(http.StatusForbidden)
				return
			}

			req.Host = req.URL.Host

			fmt.Println("Setting token", token)
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

			proxy.ServeHTTP(w, req)
			return
		}

		w.WriteHeader(http.StatusNotFound) // 404 for no matching route found
		return
	})

	fmt.Printf("Starting server on port: %d\n", *port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", strconv.Itoa(*port)), nil))
}

func getToken() (string, error) {
	key := os.Getenv("GOOGLE_SERVICE_ACCOUNT_SECRET")
	fmt.Printf("Key: %s\n", key)
	if key == "" {
		log.Fatal("GOOGLE_SERVICE_ACCOUNT_SECRET is not set")
	}

	r, err := http.NewRequest(http.MethodGet, "https://us-central1-docker.pkg.dev/v2/token?service=us-central1-docker.pkg.dev&scope=repository:e2b-dev/e2b-orchestration/docker-reverse-proxy:push%2Cpull", nil)
	if err != nil {
		fmt.Println("Error: ", err)
		return "", err
	}

	encodedKey := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("_json_key_base64:%s", key)))
	r.Header.Set("Authorization", fmt.Sprintf("Basic %s", encodedKey))

	resp, err := http.DefaultClient.Do(r)
	defer resp.Body.Close()
	if err != nil {
		fmt.Println("Error: ", err)
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Println("Status code: ", resp.StatusCode)
		return "", fmt.Errorf("status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	parsedBody := &struct {
		Token     string `json:"token"`
		ExpiresIn int    `json:"expires_in"`
	}{}

	err = json.Unmarshal(body, parsedBody)
	if err != nil {
		return "", err
	}

	return parsedBody.Token, nil
}
