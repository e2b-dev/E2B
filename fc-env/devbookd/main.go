package main

import (
	"bufio"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
)

const (
  envFilePath = "/.dbkenv"
)

var (
	wsHandler          http.Handler
	runCmd             string
	runArgs            string
	parsedRunArgs      []string
	workdir            string
	entrypoint         string
	entrypointFullPath string
)

func serveWs(w http.ResponseWriter, r *http.Request) {
	log.Println("Client connected")
	// TODO: Separate new connection?
	wsHandler.ServeHTTP(w, r)
}

func loadDBKEnvs() {
  file, err := os.Open(envFilePath)
  if err != nil {
    panic(err)
  }
  defer file.Close()

  scanner := bufio.NewScanner(file)
  // Optionally, resize scanner's capacity for lines over 64K, see next example.
  log.Println("=== Content of .dbkenv ======================")
  for scanner.Scan() {
    // Expects vars in the format "VAR_NAME=VALUE"
    // ["VAR_NAME", "VALUE"]
    envVar := scanner.Text()
    log.Println(envVar)

    name, value, found := strings.Cut(envVar, "=")
    log.Printf("\tName: %s\n", name)
    log.Printf("\tValue: %s\n", value)

    if !found {
      panic(fmt.Errorf("Invalid DBK env var format: %s", envVar))
    }

    if name == "RUN_CMD" {
      runCmd = value
    } else if name == "RUN_ARGS" {
      runArgs = value
    } else if name == "WORKDIR" {
      workdir = value
    } else if name == "ENTRYPOINT" {
      entrypoint = value
    }

    // TODO: Check if all required vars are set.
  }
  log.Println("=============================================")

  if err := scanner.Err(); err != nil {
    panic(err)
  }
}

func main() {
	parsedRunArgs = strings.Fields(runArgs)
	entrypointFullPath = path.Join(workdir, entrypoint)

	router := mux.NewRouter()
	server := rpc.NewServer()
	codeSnippet := new(CodeSnippet)
	if err := server.RegisterName("codeSnippet", codeSnippet); err != nil {
		panic(err)
	}

	wsHandler = server.WebsocketHandler([]string{"*"})
	//router.Handle("/ws", wshandler)
	router.HandleFunc("/ws", serveWs)
	err := http.ListenAndServe(":8010", router)
	if err != nil {
		panic(err)
	}
}
