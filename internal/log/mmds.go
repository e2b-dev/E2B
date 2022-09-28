package log

import (
	"net/http"
	"sync"
	"time"
)

type mmdsWriter struct {
	mu sync.RWMutex

	sessionID     *string
	codeSnippetID *string
	logAPIKey     *string
}

func newMMDSWriter() *mmdsWriter {
	w := &mmdsWriter{}

	go func() {
		ticker := time.NewTicker(time.Second * 2)
		for range ticker.C {
			// TODO: Check mmds in intervals for opts

			// if () {
			// 	w.setOpts()
			// 	return
			// }
		}
	}()

	return w
}

func (w *mmdsWriter) setOpts(sessionID, codeSnippetID, logAPIKey string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.sessionID = &sessionID
	w.codeSnippetID = &codeSnippetID
	w.logAPIKey = &logAPIKey
}

func (w *mmdsWriter) getOpts() (*string, *string, *string) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	return w.sessionID, w.codeSnippetID, w.logAPIKey
}

func (w *mmdsWriter) Write(p []byte) (int, error) {
	msg := string(p)

	sessionID, codeSnippetID, logAPIKey := w.getOpts()

	if sessionID == nil || codeSnippetID == nil || logAPIKey == nil {
		return 0, nil
	}

	// TODO: Add opts to JSON

	// curl -X POST \
	// -H 'Content-Type: application/json' \
	// -H 'Authorization: Bearer ' \
	// -d '{"dt":"'"$(date -u +'%Y-%m-%d %T UTC')"'","message":"Hello from Logtail!"}' \
	// -k \
	//
	// TODO: Add devbookd version info, add code snippet/env vars info
	// TODO: Send to MMDS or add session info (from MMDS) and send to log sink

	_, err := http.Post("https://in.logtail.com")

	return len(msg), err
}
