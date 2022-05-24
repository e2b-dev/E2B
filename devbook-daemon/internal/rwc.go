package internal

import (
	"fmt"
	"io"
	"log"
	"runtime"

	"github.com/gorilla/websocket"
)

func T(format string, args ...interface{}) {
	//return
	if _, file, line, ok := runtime.Caller(1); ok {
		msg := fmt.Sprintf(format, args...)
		log.Printf("%s:%d:%s", file, line, msg)
	} else {
		log.Printf("?:?:"+format, args...)
	}
}

type ReadWriteCloser struct {
	WS *websocket.Conn
	r  io.Reader
	w  io.WriteCloser
}

func (rwc *ReadWriteCloser) Read(p []byte) (n int, err error) {
	T("%s:%d:%s", "Read", len(p), string(p))
	if rwc.r == nil {
		var messageType int
		messageType, rwc.r, err = rwc.WS.NextReader()
		if err != nil {
			T("%s:%v", "Read", err)
			return 0, err
		}
		T("%s:%d", "Read", messageType)
	}
	for n = 0; n < len(p); {
		var m int
		m, err = rwc.r.Read(p[n:])
    log.Println(string(p))
		T("%s:%d:%v:%s", "Read", m, err, string(p))
		n += m
		if err == io.EOF {
			// done
			rwc.r = nil
			break
		}
		// ???
		if err != nil {
			break
		}
	}
	T("%s:%d:%v", "Read", n, err)
	return
}

func (rwc *ReadWriteCloser) Write(p []byte) (n int, err error) {
	T("%s:%d:%s", "Write", len(p), string(p))
  log.Println("Write")
  log.Println(string(p))
  log.Println("Write -end")
	if rwc.w == nil {
		rwc.w, err = rwc.WS.NextWriter(websocket.TextMessage)
		if err != nil {
			T("%s:%v", "Write", err)
			return 0, err
		}
	}
	for n = 0; n < len(p); {
		var m int
		m, err = rwc.w.Write(p)
		T("%s:%d:%v", "Write", m, err)
		n += m
		if err != nil {
			break
		}
	}
	if err != nil || n == len(p) {
		err = rwc.Close()
	}
	T("%s:%d:%v", "Write", n, err)
	return
}

func (rwc *ReadWriteCloser) Close() (err error) {
	T("%s", "Close")
	if rwc.w != nil {
		err = rwc.w.Close()
		rwc.w = nil
	}
	T("%s:%v", "Close", err)
	return err
}
