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

type depsManager struct {
	mu      sync.RWMutex
  deps map[string]bool

  stdoutSubscribers map[rpc.ID]*subscriber
  stderrSubscribers map[rpc.ID]*subscriber
}

func newDepsManager(stdoutSubs, stderrSubs map[rpc.ID]*subscriber) *depsManager {
  slogger.Info("Creating new deps manager")

  dm := &depsManager{
    deps:   make(map[string]bool),

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

func (dm *depsManager) notifyStdout(o *DepOutResponse) {
  for _, sub := range dm.stdoutSubscribers {
    if err := sub.Notify(o); err != nil {
      slogger.Errorw("Failed to send dep stdout notification",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
    }
  }
}

func (dm *depsManager) notifyStderr(o *DepOutResponse) {
  for _, sub := range dm.stderrSubscribers {
    if err := sub.Notify(o); err != nil {
      slogger.Errorw("Failed to send dep stderr notification",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
    }
  }
}

func (dm *depsManager) scanCmdOut(pipe io.ReadCloser, dep string, t outType) {
	scanner := bufio.NewScanner(pipe)
	scanner.Split(bufio.ScanLines)

  for scanner.Scan() {
    line := scanner.Text()

    var o DepOutResponse
    switch t {
    case OutTypeStdout:
      o = newDepStdoutResponse(dep, line)
      dm.notifyStdout(&o)
    case OutTypeStderr:
      o = newDepStderrResponse(dep, line)
      dm.notifyStderr(&o)
    }
  }
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

func (dm *depsManager) runCmd(command, dep string, args []string) error {
  cmd := exec.Command(command, args...)
  cmd.Dir = workdir

  stdout, err := cmd.StdoutPipe()
  if err != nil {
    return fmt.Errorf("Failed to set up stdout pipe for the command '%s': %s", cmd, err)
  }
  go dm.scanCmdOut(stdout, dep, OutTypeStdout)

  stderr, err := cmd.StderrPipe()
  if err != nil {
    return fmt.Errorf("Failed to set up stderr pipe for the command '%s': %s", cmd, err)
  }
  go dm.scanCmdOut(stderr, dep, OutTypeStderr)

  if err := cmd.Run(); err != nil {
    return fmt.Errorf("Failed to run '%s': %s", cmd, err)
  }
  return nil
}

func (dm *depsManager) Install(dep string) error {
  // TODO: Call the install command based on the template.
  if err := dm.runCmd(depsCmd, dep, append(parsedDepsInstallArgs, dep)); err != nil {
    return fmt.Errorf("Failed to install dep '%s': %s", dep, err)
  }

  dm.mu.Lock()
  dm.deps[dep] = true
  if err := dm.flush(); err != nil {
    return fmt.Errorf("Failed to flush a list of installed deps to a file: %s", err)
  }
  dm.mu.Unlock()
  return nil
}

func (dm *depsManager) Uninstall(dep string) error {
  // TODO: Call the uninstall command based on the template.
  if err := dm.runCmd(depsCmd, dep, append(parsedDepsUninstallArgs, dep)); err != nil {
    return fmt.Errorf("Failed to uninstall dep '%s': %s", dep, err)
  }

  dm.mu.Lock()
  delete(dm.deps, dep)
  if err := dm.flush(); err != nil {
    return fmt.Errorf("Failed to flush a list of installed deps to a file: %s", err)
  }
  dm.mu.Unlock()
  return nil
}
