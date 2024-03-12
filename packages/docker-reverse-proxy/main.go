package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
)

type DebugTransport struct{}

func (DebugTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	b, err := httputil.DumpRequestOut(r, false)
	if err != nil {
		return nil, err
	}
	fmt.Println(string(b))
	return http.DefaultTransport.RoundTrip(r)
}

func main() {
	port := flag.Int("port", 5000, "Port for test HTTP server")
	flag.Parse()

	targetUrl := &url.URL{
		Scheme: "https",
		Host:   "us-central1-docker.pkg.dev",
	}
	proxy := httputil.NewSingleHostReverseProxy(targetUrl)
	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			return
		}

		req.Host = req.URL.Host

		proxy.ServeHTTP(w, req)
	})
	proxy.Transport = DebugTransport{}

	println("Starting server on port", *port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%s", strconv.Itoa(*port)), nil))
}
