package watcher

import (
	"fmt"
	"os"
	"path"
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

type Event struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Operation Op     `json:"operation"`
	// Timestamp is nanoseconds since epoch
	Timestamp int64 `json:"timestamp"`
	// Directory doesn't hold a valid value for the remove operation.
	// Because we can't stat a path that just got removed to find out
	// if it was a file or a dir that got removed.
	Directory bool `json:"isDir"`
}

func newEvent(event fsnotify.Event) (Event, error) {
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
			return Event{}, fmt.Errorf("failed to stat path '%s': %w", event.Name, err)
		}

		dir = stat.IsDir()
	}

	return Event{
		Operation: op,
		Path:      event.Name,
		Name:      path.Base(event.Name),
		Timestamp: time.Now().UnixNano(),
		Directory: dir,
	}, nil
}
