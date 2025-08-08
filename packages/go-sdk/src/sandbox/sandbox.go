package sandbox

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// HTTPClient wraps the HTTP client for sandbox operations
type HTTPClient struct {
	client *http.Client
}

// NewHTTPClient creates a new HTTP client for sandbox operations
func NewHTTPClient() *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: 300 * time.Second,
		},
	}
}

type SandboxResponse struct {
	SandboxID       string  `json:"sandboxID"`
	ClientID        string  `json:"clientID"`
	EnvdAccessToken *string `json:"envdAccessToken,omitempty"`
}

const apiBaseURL = "https://api.e2b.dev/sandboxes"

func CreateSandbox(templateID string, timeout int) (SandboxResponse, error) {
	apiKey := os.Getenv("E2B_API_KEY")
	if apiKey == "" {
		return SandboxResponse{}, fmt.Errorf("E2B_API_KEY environment variable is not set")
	}

	url := apiBaseURL
	payload := map[string]interface{}{
		"templateID": templateID,
		"timeout":    timeout,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return SandboxResponse{}, fmt.Errorf("failed to marshal request payload: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return SandboxResponse{}, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 300 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return SandboxResponse{}, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return SandboxResponse{}, fmt.Errorf("request failed with status: %d", resp.StatusCode)
	}

	var result SandboxResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return SandboxResponse{}, fmt.Errorf("failed to decode response: %v", err)
	}

	if result.SandboxID == "" || result.ClientID == "" {
		return SandboxResponse{}, fmt.Errorf("invalid response: missing sandboxID or clientID")
	}

	return result, nil
}

func KillSandbox(sandboxID string) error {
	apiKey := os.Getenv("E2B_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("E2B_API_KEY environment variable is not set")
	}

	url := fmt.Sprintf("%s/%s", apiBaseURL, sandboxID)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("X-API-Key", apiKey)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("request failed with status: %d", resp.StatusCode)
	}

	return nil
}
