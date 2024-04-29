package watcher

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
	"go.uber.org/zap"
)

// DirWatcher allows to watch directories.
// DirWatcher returns an error when trying to watch files.
type DirWatcher struct {
	logger  *zap.SugaredLogger
	watcher *fsnotify.Watcher
	Errors  chan error
	Events  chan Event
	// watcherDirs is an array of directories that are being watched.
	// Even though watcher has a WatchList() property with all watched
	// paths we keep a track of watched dirs on our own to solve the "two remove events" problem.
	// The problem is described in the `watchLoop` function.
	watchedDirs []string
	mu          sync.Mutex
}

func NewDirWatcher(logger *zap.SugaredLogger) (*DirWatcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	dw := &DirWatcher{
		logger:      logger,
		watcher:     w,
		Events:      make(chan Event),
		Errors:      make(chan error),
		watchedDirs: make([]string, 0),
	}

	go dw.watchLoop()

	return dw, nil
}

func (dw *DirWatcher) watchLoop() {
	for {
		select {
		case err, ok := <-dw.watcher.Errors:
			if !ok {
				dw.logger.Error("watcher.Errors got closed")
				close(dw.watcher.Errors)

				return
			}
			dw.watcher.Errors <- err
		case e, ok := <-dw.watcher.Events:
			if !ok {
				dw.logger.Debug("watcher.Events got closed")
				close(dw.Events)

				return
			}

			parentPath := filepath.Dir(e.Name)

			// **Problem**: When fswatcher is watching both /dirA and /dirA/dirB and dirB is deleted, we receive two remove events.
			// The first event is received because we're watching the dirB and it got removed.
			// The second event is received because we're watching the dirB and one of its children got removed.
			//
			// **Goal**: Ignore the first event associated with the dirB watcher and only report the second event.
			//
			// **Solution**: Let's rely on the fact that if we're watching both a dir and it's parent dir we always must receive
			// two remove events. Because we keep an array of watched dirs in the `watchedDirs` variable and only allow watching dirs
			// (WatchDir() returns an error if trying to watch a file) we can check if both the event's path (`e.Name`) and `parentPath`
			// are in the array. If both paths are in the array then the remove event must be associated with removing a directory that's
			// being watched. We can ignore the event because we will receive another event associated with the parent directory.
			//
			// **Drawbacks**: One drawback is that if we're watching only dirB and not dirA and dirB get's removed we never get's to know
			// about it. I think that's fine for our use case. We just need to make sure to always watch parent dirs and don't allow users
			// to delete the root dirs.
			if fsnotify.Remove.Has(e.Op) && dw.isInWatchedDirs(e.Name) && dw.isInWatchedDirs(parentPath) {
				// We must remove a path of the dir that just got removed from our array so this condition won't get triggered
				// when we receive the second remove event.
				dw.removeFromWatchedDirs(e.Name)

				// No need for removing the path (e.Name) from fswatcher because it removed the path on its own.

				continue
			}

			ourEvent, err := newEvent(e)
			if err != nil {
				dw.logger.Errorw(
					"Failed to create our event wrapper",
					"originalEvent", e,
					"error", err,
				)

				continue
			}

			dw.logger.Infow("Filesystem watched event",
				"event", ourEvent,
			)

			dw.Events <- ourEvent
		}
	}
}

func (dw *DirWatcher) removeFromWatchedDirs(dirpath string) {
	dw.mu.Lock()
	defer dw.mu.Unlock()

	filtered := []string{}

	for _, p := range dw.watchedDirs {
		if p != dirpath {
			filtered = append(filtered, p)
		}
	}

	dw.watchedDirs = filtered
}

func (dw *DirWatcher) addToWatchedDirs(dirpath string) {
	dw.mu.Lock()
	defer dw.mu.Unlock()

	exists := false

	for _, p := range dw.watchedDirs {
		if p == dirpath {
			exists = true

			break
		}
	}

	if !exists {
		dw.watchedDirs = append(dw.watchedDirs, dirpath)
	}
}

func (dw *DirWatcher) isInWatchedDirs(dirpath string) bool {
	dw.mu.Lock()
	defer dw.mu.Unlock()

	exists := false

	for _, p := range dw.watchedDirs {
		if p == dirpath {
			exists = true

			break
		}
	}

	return exists
}

func (dw *DirWatcher) addToWatcher(dirpath string) error {
	dw.addToWatchedDirs(dirpath)

	watching := false

	for _, p := range dw.watcher.WatchList() {
		if p == dirpath {
			watching = true

			dw.logger.Warnw(
				"The path is already being watched",
				"path", dirpath,
			)

			break
		}
	}

	if !watching {
		dw.logger.Debugw(
			"Will add path to watcher",
			"path", dirpath,
			"WatchList", dw.watcher.WatchList(),
			"watchedDirs", dw.watchedDirs,
		)

		if err := dw.watcher.Add(dirpath); err != nil {
			dw.removeFromWatchedDirs(dirpath)
			dw.logger.Errorw(
				"Failed to add path to watcher",
				"path", dirpath,
				"WatchList", dw.watcher.WatchList(),
				"watchedDirs", dw.watchedDirs,
			)

			return fmt.Errorf("'%s': failed to watch: %w", dirpath, err)
		}
	}

	return nil
}

func (dw *DirWatcher) Add(dirpath string) error {
	// We never watch individual files. We only allow watching dirs because watching individual files is problematic.
	// See https://pkg.go.dev/github.com/fsnotify/fsnotify#hdr-Watching_files.

	stat, err := os.Stat(dirpath)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("'%s': doesn't exist. Only existing paths are supported", dirpath)
	} else if err != nil {
		return fmt.Errorf("failed to stat path '%s': %w", dirpath, err)
	}

	if !stat.IsDir() {
		return fmt.Errorf("'%s': is not a directory. Only directories are supported", dirpath)
	}

	return dw.addToWatcher(dirpath)
}

func (dw *DirWatcher) Remove(dirpath string) error {
	dw.logger.Infow(
		"Removing path from WatchList",
		"path", dirpath,
		"watchList", dw.watcher.WatchList(),
		"watchedDirs", dw.watchedDirs,
	)
	// We can safely ignore errors that originated from trying to remove a path that isn't watched anymore.
	if err := dw.watcher.Remove(dirpath); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
		return fmt.Errorf("'%s': failed to remove from watcher: %w", dirpath, err)
	}

	dw.removeFromWatchedDirs(dirpath)

	dw.logger.Debugw(
		"either successfully removed path from WatchList or path wasn't in the WatchList in the first place",
		"path", dirpath,
		"WatchList", dw.watcher.WatchList(),
		"watchedDirs", dw.watchedDirs,
	)

	return nil
}
