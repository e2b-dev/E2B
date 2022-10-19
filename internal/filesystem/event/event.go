package event

import (
	"fmt"
	"os"
	"time"

	"github.com/fsnotify/fsnotify"
)

type Op string

const (
	Create Op = "Create"
	Write  Op = "Write"
	Remove Op = "Remove"
	Rename Op = "Rename"
	Chmod  Op = "Chmod"
)

// EventMessage is the message that filesystem/watch RPC subscribers receive
// on a change on a filesystem path.
type EventMessage struct {
	Path      string `json:"path"`
	Operation Op     `json:"operation"`
	// Timestamp is nanoseconds since epoch
	Timestamp int64 `json:"timestamp"`
	Directory bool  `json:"isDirectory"`
}

func NewEventMessage(event fsnotify.Event) (*EventMessage, error) {
	var op Op
	if fsnotify.Create.Has(event.Op) {
		op = Create
	} else if fsnotify.Write.Has(event.Op) {
		op = Write
	} else if fsnotify.Remove.Has(event.Op) {
		op = Remove
	} else if fsnotify.Rename.Has(event.Op) {
		op = Rename
	} else if fsnotify.Chmod.Has(event.Op) {
		op = Chmod
	}

	dir := false
	if op != Remove && op != Rename {
		stat, err := os.Stat(event.Name)
		if err != nil {
			return nil, fmt.Errorf("failed to stat path '%s': %s", event.Name, err)
		}
		dir = stat.IsDir()
	}

	return &EventMessage{
		Operation: op,
		Path:      event.Name,
		Timestamp: time.Now().UnixNano(),
		Directory: dir,
	}, nil
}
