package log

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"go.uber.org/zap"
)

const (
	mmdsDefaultAddress  = "169.254.169.254"
	mmdsTokenExpiration = 60 // seconds
)

type sessionWriter struct {
	client *http.Client
	logger *zap.SugaredLogger
}

type opts struct {
	SessionID     *string `json:"sessionID"`
	CodeSnippetID *string `json:"codeSnippetID"`
	Address       *string `json:"address"`
}

func addOptsToJSON(jsonLogs []byte, opts *opts) ([]byte, error) {
	var parsed map[string]interface{}

	json.Unmarshal(jsonLogs, &parsed)

	parsed["sessionID"] = *opts.SessionID
	parsed["codeSnippetID"] = *opts.CodeSnippetID

	data, err := json.Marshal(parsed)
	return data, err
}

func newSessionWriter(logger *zap.SugaredLogger) *sessionWriter {
	return &sessionWriter{
		logger: logger,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (w *sessionWriter) getMMDSToken(expiration int) (string, error) {
	request, err := http.NewRequest("PUT", "http://"+mmdsDefaultAddress+"/latest/api/token", new(bytes.Buffer))
	if err != nil {
		return "", err
	}
	request.Header["X-metadata-token-ttl-seconds"] = []string{strconv.FormatInt(int64(expiration), 10)}

	response, err := w.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "", err
	}

	token := string(body)

	if len(token) == 0 {
		return "", fmt.Errorf("mmds token is an empty string")
	}

	return token, nil
}

func (w *sessionWriter) getMMDSOpts(token string) (*opts, error) {
	request, err := http.NewRequest("GET", "http://"+mmdsDefaultAddress, new(bytes.Buffer))
	if err != nil {
		return nil, err
	}
	request.Header["X-metadata-token"] = []string{token}
	request.Header["Accept"] = []string{"application/json"}

	response, err := w.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var opts opts
	err = json.Unmarshal(body, &opts)
	if err != nil {
		return nil, err
	}

	if opts.Address == nil {
		return nil, fmt.Errorf("no 'address' in mmds opts")
	}

	if opts.CodeSnippetID == nil {
		return nil, fmt.Errorf("no 'codeSnippetID' in mmds opts")
	}

	if opts.SessionID == nil {
		return nil, fmt.Errorf("no 'sessionID' in mmds opts")
	}

	return &opts, nil
}

func (w *sessionWriter) sendSessionLogs(logs []byte, address string) error {
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

func (w *sessionWriter) Write(logs []byte) (int, error) {
	go func() {
		mmdsToken, err := w.getMMDSToken(mmdsTokenExpiration)
		if err != nil {
			errMsg := fmt.Sprintf("error getting mmds token: %+v", err)
			w.logger.Error(errMsg)
			return
		}

		mmdsOpts, err := w.getMMDSOpts(mmdsToken)
		if err != nil {
			errMsg := fmt.Sprintf("error getting session logging options from mmds (token %s): %+v", mmdsToken, err)
			w.logger.Error(errMsg)
			return
		}

		sessionLogs, err := addOptsToJSON(logs, mmdsOpts)
		if err != nil {
			errMsg := fmt.Sprintf("error adding session logging options (%+v) to JSON (%+v) with logs : %+v", mmdsOpts, logs, err)
			w.logger.Error(errMsg)
			return
		}

		err = w.sendSessionLogs(sessionLogs, *mmdsOpts.Address)
		if err != nil {
			errMsg := fmt.Sprintf("error sending session logs: %+v", err)
			w.logger.Error(errMsg)
			return
		}
	}()

	return len(logs), nil
}
