package output

import "time"

const (
	OutTypeStdout OutType = "Stdout"
	OutTypeStderr OutType = "Stderr"
)

type OutType string

type OutResponse struct {
	Type      OutType `json:"type"`
	Line      string  `json:"line"`
	Timestamp int64   `json:"timestamp"` // Nanoseconds since epoch
}

func NewStdoutResponse(line string) OutResponse {
	return OutResponse{
		Type:      OutTypeStdout,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
	}
}

func NewStderrResponse(line string) OutResponse {
	return OutResponse{
		Type:      OutTypeStderr,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
	}
}
