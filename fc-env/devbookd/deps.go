package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"

	"github.com/ethereum/go-ethereum/rpc"
)

const (
  depsFilePath = "/.dbkdeps.json"
)

func scanPipe(pipe io.ReadCloser, subs map[rpc.ID]*subscriber) {
	scanner := bufio.NewScanner(pipe)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
    for _, sub := range subs {
      if err := sub.Notify(scanner.Text()); err != nil {
        slogger.Errorw("Failed to send dep stdout/stderr notification",
          "subscriptionID", sub.SubscriptionID(),
          "error", err,
        )
      }
    }
	}
}

type depsManager struct {
	mu      sync.RWMutex
  deps map[string]bool

  Stdout chan string
  Stderr chan string

  stdoutSubscribers map[rpc.ID]*subscriber
  stderrSubscribers map[rpc.ID]*subscriber
}

func newDepsManager(stdoutSubs, stderrSubs map[rpc.ID]*subscriber) *depsManager {
  slogger.Info("Creating new deps manager")

  dm := &depsManager{
    deps:   make(map[string]bool),

    Stdout: make(chan string),
    Stderr: make(chan string),

    stdoutSubscribers: stdoutSubs,
    stderrSubscribers: stderrSubs,
  }

  content, err := os.ReadFile(depsFilePath)
  if err != nil {
    slogger.Errorw("Failed to read the deps file, will treat it as if no deps are installed",
      "depsFile", depsFilePath,
      "error", err,
    )
    return dm
  }

  var deps map[string]bool
  if err = json.Unmarshal(content, &deps); err != nil {
    slogger.Errorw("Failed to unmarshal deps file to JSON, will treat it as if no deps are installed",
      "depsFile", depsFilePath,
      "error", err,
      "content", string(content),
    )
    return dm
  }

  slogger.Infow("Loaded dependencies from deps file",
    "depsFile", depsFilePath,
    "deps", deps,
  )

  dm.deps = deps
  return dm
}

func (dm *depsManager) flush() error {
  j, err := json.Marshal(dm.deps)
  if err != nil {
    return fmt.Errorf("Failed to marhsal deps: %s", err)
  }

  if err := os.WriteFile(depsFilePath, j, 0644); err != nil {
    return fmt.Errorf("Failed to write deps to file '%s': %s", depsFilePath, err)
  }

  return nil
}

func (dm *depsManager) Deps() []string {
  dm.mu.RLock()
  defer dm.mu.RUnlock()

  deps := make([]string, len(dm.deps))
  i := 0
  for k := range dm.deps {
    deps[i] = k
    i++
  }
  return deps
}

func (dm *depsManager) Install(dep string) error {
  // TODO: Call install command based on the template.
  // TODO: Add installed dep to dm.deps and flush it to a file.
  cmd := exec.Command("npm", "install", dep)
  cmd.Dir = workdir

  stdout, err := cmd.StdoutPipe()
  if err != nil {
    return fmt.Errorf("Failed to set up stdout pipe for the install command '%s': %s", cmd, err)
  }
  go scanPipe(stdout, dm.stdoutSubscribers)

  stderr, err := cmd.StderrPipe()
  if err != nil {
    return fmt.Errorf("Failed to set up stderr pipe for the install command '%s': %s", cmd, err)
  }
  go scanPipe(stderr, dm.stderrSubscribers)

  if err := cmd.Run(); err != nil {
    return fmt.Errorf("Failed to install '%s': %s", dep, err)
  }

  dm.mu.Lock()
  dm.deps[dep] = true
  if err := dm.flush(); err != nil {
    // TODO
  }
  dm.mu.Unlock()

  return nil
}

func (dm *depsManager) Uninstall(dep string) error {
  dm.mu.Lock()
  defer dm.mu.Unlock()

  // TODO: Call uninstall command based on the template.
  return nil
}
