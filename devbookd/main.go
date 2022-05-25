package main

import (
	"log"
	"net/http"

	"github.com/ethereum/go-ethereum/rpc"
	"github.com/gorilla/mux"
)


func serveWs(w http.ResponseWriter, r *http.Request) {
	log.Println("Client connected")
  // TODO: Separate new connection?
  wsHandler.ServeHTTP(w, r)
}

var wsHandler http.Handler

func main() {
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
