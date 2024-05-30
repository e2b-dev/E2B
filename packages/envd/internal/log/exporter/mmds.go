package exporter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	mmdsDefaultAddress  = "169.254.169.254"
	mmdsTokenExpiration = 60 * time.Second
)

type opts struct {
	TraceID    string `json:"traceID"`
	InstanceID string `json:"instanceID"`
	EnvID      string `json:"envID"`
	Address    string `json:"address"`
	TeamID     string `json:"teamID"`
}

func (opts *opts) addOptsToJSON(jsonLogs []byte) ([]byte, error) {
	parsed := make(map[string]interface{})

	err := json.Unmarshal(jsonLogs, &parsed)
	if err != nil {
		return nil, err
	}

	parsed["instanceID"] = opts.InstanceID
	parsed["envID"] = opts.EnvID
	parsed["traceID"] = opts.TraceID
	parsed["teamID"] = opts.TeamID

	data, err := json.Marshal(parsed)

	return data, err
}

func (w *HTTPLogsExporter) getMMDSToken() (string, error) {
	request, err := http.NewRequest("PUT", "http://"+mmdsDefaultAddress+"/latest/api/token", new(bytes.Buffer))
	if err != nil {
		return "", err
	}

	request.Header["X-metadata-token-ttl-seconds"] = []string{fmt.Sprint(mmdsTokenExpiration.Seconds())}

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

func (w *HTTPLogsExporter) doMmdsRequest(token string) (*opts, error) {
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

	return &opts, nil
}

func (w *HTTPLogsExporter) waitForMMDS() {
	for {
		token, err := w.getMMDSToken()
		if err != nil {
			fmt.Printf("error getting mmds token: %v\n", err)
			continue
		}

		mmdsOpts, err := w.doMmdsRequest(token)
		if err != nil {
			fmt.Printf("error getting mmds opts: %v\n", err)
			continue
		}

		if mmdsOpts.Address != "" {
			return
		}
	}
}

func (w *HTTPLogsExporter) getMMDSOpts(token string) (opts *opts, err error) {
	opts, err = w.doMmdsRequest(token)
	if err != nil {
		return nil, err
	}

	if opts.Address == "" {
		return nil, fmt.Errorf("no 'address' in mmds opts")
	}

	if opts.EnvID == "" {
		return nil, fmt.Errorf("no 'envID' in mmds opts")
	}

	if opts.InstanceID == "" {
		return nil, fmt.Errorf("no 'instanceID' in mmds opts")
	}

	return opts, nil
}
