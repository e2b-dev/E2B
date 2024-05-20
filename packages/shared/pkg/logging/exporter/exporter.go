package exporter

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var vectorAddress = os.Getenv("VECTOR_ADDRESS")

type HTTPLogsExporter struct {
	client   http.Client
	triggers chan struct{}
	logs     [][]byte
	sync.Mutex
	debug bool
}

func NewHTTPLogsExporter(debug bool) *HTTPLogsExporter {
	exporter := &HTTPLogsExporter{
		client: http.Client{
			Timeout: 2 * time.Second,
		},
		triggers: make(chan struct{}, 1),
		debug:    debug,
	}

	go exporter.start()

	return exporter
}

func (w *HTTPLogsExporter) sendInstanceLogs(logs []byte, address string) error {
	request, err := http.NewRequest("POST", address, bytes.NewBuffer(logs))
	if err != nil {
		return err
	}

	request.Header.Set("Content-Type", "application/json")

	response, err := w.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return nil
}

func (w *HTTPLogsExporter) start() {
	for range w.triggers {
		logs := w.getAllLogs()

		if len(logs) == 0 {
			continue
		}

		for _, logEntry := range logs {
			if w.debug {
				fmt.Printf("%v\n", string(logEntry))

				continue
			} else {
				err := w.sendInstanceLogs(logs[0], vectorAddress)
				if err != nil {
					log.Fatalf("error sending logs: %v", err)
				}
			}
		}
	}
}

func (w *HTTPLogsExporter) resumeProcessing() {
	select {
	case w.triggers <- struct{}{}:
	default:
		// Exporter processing already triggered
		// This is expected behavior if the exporter is already processing logs
	}
}

func (w *HTTPLogsExporter) Write(logs []byte) (int, error) {
	logsCopy := make([]byte, len(logs))
	copy(logsCopy, logs)

	go w.addLogs(logsCopy)

	return len(logs), nil
}

func (w *HTTPLogsExporter) getAllLogs() [][]byte {
	w.Lock()
	defer w.Unlock()

	logs := w.logs
	w.logs = nil

	return logs
}

func (w *HTTPLogsExporter) addLogs(logs []byte) {
	w.Lock()
	defer w.Unlock()

	w.logs = append(w.logs, logs)

	w.resumeProcessing()
}
