package main

import (
	"log"
	"net/http"
	"net/rpc"
	"net/rpc/jsonrpc"
	"time"

	"github.com/gorilla/websocket"
  "github.com/devbookhq/orchestration-services/devbookd/internal"
)

func main() {
	http.HandleFunc("/ws", serveWs)
	err := http.ListenAndServe(":8010", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  internal.MaxMessageSize,
	WriteBufferSize: internal.MaxMessageSize,
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	log.Println("serveWs")

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", 405)
		return
	}

  upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	handle(ws)
}

func wsping(ws *websocket.Conn, deadline time.Duration) error {
	return ws.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(deadline*time.Second))
}

func wsclose(ws *websocket.Conn, deadline time.Duration) error {
	return ws.WriteControl(websocket.CloseMessage, []byte{}, time.Now().Add(deadline*time.Second))
}

func handle(ws *websocket.Conn) {
	defer func() {
		deadline := 1 * time.Second
		wsclose(ws, deadline)
		time.Sleep(deadline)
		ws.Close()
	}()

	ws.SetReadLimit(internal.MaxMessageSize)
	ws.SetReadDeadline(time.Now().Add(internal.PongWait))
	ws.SetPongHandler(func(string) error {
    log.Println("Pong handler")
		ws.SetReadDeadline(time.Now().Add(internal.PongWait))
		return nil
	})

	go func() {
		ticker := time.Tick(internal.PongWait / 2)
		for range ticker {
      log.Println("Will ping")
			if err := wsping(ws, internal.PongWait); err != nil {
				log.Println("Ping failed:", err)
				break
			}
		}
		wsclose(ws, 1)
	}()

	rwc := &internal.ReadWriteCloser{WS: ws}
	s := rpc.NewServer()
	comm := &Comm{}
	s.Register(comm)
	s.ServeCodec(jsonrpc.NewServerCodec(rwc))
	// s.ServeConn(rwc)
}
