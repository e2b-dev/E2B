package exporter

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

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

		if w.debug {
			for _, log := range logs {
				fmt.Fprintf(os.Stdout, "%v", string(log))
			}

			continue
		}

		token, err := w.getMMDSToken()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error getting mmds token: %v\n", err)

			// w.Lock()
			// w.logs = append(w.logs, logs...)
			// w.Unlock()

			continue
		}

		mmdsOpts, err := w.getMMDSOpts(token)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error getting instance logging options from mmds (token %s): %v\n", token, err)

			// w.Lock()
			// w.logs = append(w.logs, logs...)
			// w.Unlock()

			continue
		}

		for _, log := range logs {
			logsWithOpts, jsonErr := mmdsOpts.addOptsToJSON(log)
			if jsonErr != nil {
				fmt.Fprintf(os.Stderr, "error adding instance logging options (%+v) to JSON (%+v) with logs : %v\n", mmdsOpts, log, jsonErr)

				// w.Lock()
				// w.logs = append(w.logs, log)
				// w.Unlock()

				continue
			}

			err = w.sendInstanceLogs(logsWithOpts, mmdsOpts.Address)
			if err != nil {
				fmt.Fprintf(os.Stderr, fmt.Sprintf("error sending instance logs: %+v", err))

				// w.Lock()
				// w.logs = append(w.logs, log)
				// w.Unlock()

				continue
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
