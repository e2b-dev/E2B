package log

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	mmdsDefaultAddress = "169.254.169.254"
)

var mmdsTokenExpiration = 60 * time.Second

type instanceLogsWriter struct{}

type opts struct {
	TraceID    string `json:"traceID"`
	InstanceID string `json:"instanceID"`
	EnvID      string `json:"envID"`
	Address    string `json:"address"`
}

func addOptsToJSON(jsonLogs []byte, opts *opts) ([]byte, error) {
	parsed := make(map[string]interface{})

	err := json.Unmarshal(jsonLogs, &parsed)
	if err != nil {
		return nil, err
	}

	parsed["instanceID"] = opts.InstanceID
	parsed["envID"] = opts.EnvID
	parsed["traceID"] = opts.TraceID

	data, err := json.Marshal(parsed)

	return data, err
}

func getMMDSToken(client http.Client) (string, error) {
	request, err := http.NewRequest("PUT", "http://"+mmdsDefaultAddress+"/latest/api/token", new(bytes.Buffer))
	if err != nil {
		return "", err
	}

	request.Header["X-metadata-token-ttl-seconds"] = []string{fmt.Sprint(mmdsTokenExpiration.Seconds())}

	response, err := client.Do(request)
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

func getMMDSOpts(client http.Client, token string) (*opts, error) {
	request, err := http.NewRequest("GET", "http://"+mmdsDefaultAddress, new(bytes.Buffer))
	if err != nil {
		return nil, err
	}

	request.Header["X-metadata-token"] = []string{token}
	request.Header["Accept"] = []string{"application/json"}

	response, err := client.Do(request)
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

	if opts.Address == "" {
		return nil, fmt.Errorf("no 'address' in mmds opts")
	}

	if opts.EnvID == "" {
		return nil, fmt.Errorf("no 'envID' in mmds opts")
	}

	if opts.InstanceID == "" {
		return nil, fmt.Errorf("no 'instanceID' in mmds opts")
	}

	return &opts, nil
}

func sendInstanceLogs(client http.Client, logs []byte, address string) error {
	request, err := http.NewRequest("POST", address, bytes.NewBuffer(logs))
	if err != nil {
		return err
	}

	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	return nil
}

func sendLogs(logs []byte) {
	client := http.Client{
		Timeout: 2 * time.Second,
	}

	mmdsToken, err := getMMDSToken(client)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error getting mmds token: %v\n", err)

		return
	}

	mmdsOpts, err := getMMDSOpts(client, mmdsToken)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error getting instance logging options from mmds (token %s): %v\n", mmdsToken, err)

		return
	}

	instanceLogs, err := addOptsToJSON(logs, mmdsOpts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error adding instance logging options (%+v) to JSON (%+v) with logs : %v\n", mmdsOpts, logs, err)

		return
	}

	err = sendInstanceLogs(client, instanceLogs, mmdsOpts.Address)
	if err != nil {
		fmt.Fprint(os.Stderr, fmt.Sprintf("error sending instance logs: %+v", err))

		return
	}
}

func (w *instanceLogsWriter) Write(logs []byte) (int, error) {
	go sendLogs(logs)

	return len(logs), nil
}
