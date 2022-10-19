package output

import "time"

type OutType string

const (
	OutTypeStdout OutType = "Stdout"
	OutTypeStderr OutType = "Stderr"
)

type OutMessage struct {
	Type OutType `json:"type"`
	Line string  `json:"line"`
	// Timestamp is nanoseconds since epoch
	Timestamp int64 `json:"timestamp"`
}

func NewStdoutMessage(line string) OutMessage {
	return OutMessage{
		Type:      OutTypeStdout,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
	}
}

func NewStderrMessage(line string) OutMessage {
	return OutMessage{
		Type:      OutTypeStderr,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
	}
}
