package main

import (
	"bufio"
	"context"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/drael/GOnetstat"
	"github.com/ethereum/go-ethereum/rpc"
)

type CodeSnippetState string
type outType string

type ErrResponse struct {
  Error string `json:"error"`
}

type OutResponse struct {
  Type      outType `json:"type"`
  Line      string  `json:"line"`
  Timestamp int64   `json:"timestamp"` // Nanoseconds since epoch
}

func newStdoutResponse(line string) OutResponse {
  return OutResponse{
    Type: OutTypeStdout,
    Line: line,
    Timestamp: time.Now().UnixNano(),
  }
}

func newStderrResponse(line string) OutResponse {
  return OutResponse{
    Type: OutTypeStderr,
    Line: line,
    Timestamp: time.Now().UnixNano(),
  }
}

type DepOutResponse struct {
  OutResponse
  Dep string `json:"dep"`
}

func newDepStdoutResponse(dep, line string) DepOutResponse {
  return DepOutResponse{
    OutResponse: newStdoutResponse(line),
    Dep: dep,
  }
}

func newDepStderrResponse(dep, line string) DepOutResponse {
  return DepOutResponse{
    OutResponse: newStderrResponse(line),
    Dep: dep,
  }
}

const (
  OutTypeStdout outType = "Stdout"
  OutTypeStderr outType = "Stderr"

	CodeSnippetStateRunning CodeSnippetState = "Running"
	CodeSnippetStateStopped CodeSnippetState = "Stopped"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160


type CodeSnippet struct {
	cmd     *exec.Cmd
	mu      sync.Mutex
	running bool

  // The reason for caching cmd's outputs is if a client connects while the command
  // is already running we can send all the output that has happened since the start
  // of the command.
  // This way a user on the frontend doesn't even notice that command has been running.
  cachedOut []OutResponse

  depsManager *depsManager

	stdoutSubscribers          map[rpc.ID]*subscriber
	stderrSubscribers          map[rpc.ID]*subscriber
	stateSubscribers           map[rpc.ID]*subscriber
  depsChangeSubscribers      map[rpc.ID]*subscriber
  depsStdoutSubscribers      map[rpc.ID]*subscriber
  depsStderrSubscribers      map[rpc.ID]*subscriber
  scanOpenedPortsSubscribers map[rpc.ID]*subscriber
}

func NewCodeSnippetService() *CodeSnippet {
  cs := &CodeSnippet{
		stdoutSubscribers:          make(map[rpc.ID]*subscriber),
		stderrSubscribers:          make(map[rpc.ID]*subscriber),
		stateSubscribers:           make(map[rpc.ID]*subscriber),
    depsChangeSubscribers:      make(map[rpc.ID]*subscriber),
    depsStdoutSubscribers:      make(map[rpc.ID]*subscriber),
    depsStderrSubscribers:      make(map[rpc.ID]*subscriber),
    scanOpenedPortsSubscribers: make(map[rpc.ID]*subscriber),
	}
  cs.depsManager = newDepsManager(cs.depsStdoutSubscribers, cs.depsStderrSubscribers)
  go cs.scanTCPPorts()
  return cs
}

func (cs *CodeSnippet) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*subscriber) (*subscriber, error) {
	sub, err := newSubscriber(ctx)
	if err != nil {
		return nil, err
	}

	// Watch for subscription errors.
	go func() {
		select {
		case err := <-sub.subscription.Err():
			slogger.Errorw("Subscribtion error",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
			delete(subs, sub.SubscriptionID())
		}
	}()

  subs[sub.SubscriptionID()] = sub
  return sub, nil
}

func (cs *CodeSnippet) setRunning(b bool) {
	cs.running = b
	var state CodeSnippetState
	if b {
		state = CodeSnippetStateRunning
	} else {
		state = CodeSnippetStateStopped
	}
	cs.notifyState(state)
}

func (cs *CodeSnippet) scanTCPPorts() {
  ticker := time.NewTicker(1 * time.Second)
  for {
    select {
    case <-ticker.C:
      d := GOnetstat.Tcp()
      cs.notifyScanOpenedPorts(d)
    }
  }
}

func (cs *CodeSnippet) notifyScanOpenedPorts(ports []GOnetstat.Process) {
  for _, sub := range cs.scanOpenedPortsSubscribers {
		if err := sub.Notify(ports); err != nil {
			slogger.Errorw("Failed to send scan opened ports notification",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
		}
  }
}

func (cs *CodeSnippet) notifyDepsChange() {
  for _, sub := range cs.depsChangeSubscribers {
		if err := sub.Notify(cs.depsManager.Deps()); err != nil {
			slogger.Errorw("Failed to send deps change notification",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
		}
  }
}

func (cs *CodeSnippet) notifyOut(o *OutResponse) {
  switch o.Type {
    case OutTypeStdout:
      for _, sub := range cs.stdoutSubscribers {
        if err := sub.Notify(o); err != nil {
          slogger.Errorw("Failed to send stdout notification",
            "subscriptionID", sub.SubscriptionID(),
            "error", err,
          )
        }
      }
    case OutTypeStderr:
      for _, sub := range cs.stderrSubscribers {
        if err := sub.Notify(o); err != nil {
          slogger.Errorw("Failed to send stderr notification",
            "subscriptionID", sub.SubscriptionID(),
            "error", err,
          )
        }
      }
  }
}

func (cs *CodeSnippet) notifyState(state CodeSnippetState) {
	for _, sub := range cs.stateSubscribers {
		if err := sub.Notify(state); err != nil {
			slogger.Errorw("Failed to send state notification",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
		}
	}
}

func (cs *CodeSnippet) scanRunCmdOut(pipe io.ReadCloser, t outType) {
	scanner := bufio.NewScanner(pipe)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
    line := scanner.Text()

    var o OutResponse
    switch t {
    case OutTypeStdout:
      o = newStdoutResponse(line)
    case OutTypeStderr:
      o = newStderrResponse(line)
    }
    cs.cachedOut = append(cs.cachedOut, o)
    cs.notifyOut(&o)
	}
}

func (cs *CodeSnippet) runCmd(code string) {
	defer func() {
		cs.mu.Lock()
		cs.setRunning(false)
		cs.mu.Unlock()
	}()

	if err := os.WriteFile(entrypointFullPath, []byte(code), 0755); err != nil {
		slogger.Errorw("Failed to write to the entrypoint file",
			"entrypointFullPath", entrypointFullPath,
			"error", err,
		)
	}

	cs.cmd = exec.Command(runCmd, parsedRunArgs...)
	cs.cmd.Dir = workdir

	stdout, err := cs.cmd.StdoutPipe()
	if err != nil {
		slogger.Errorw("Failed to set up stdout pipe for the run command",
			"cmd", cs.cmd,
			"error", err,
		)
    o := newStderrResponse(err.Error())
    cs.notifyOut(&o)
	}
  go cs.scanRunCmdOut(stdout, OutTypeStdout)

	stderr, err := cs.cmd.StderrPipe()
	if err != nil {
		slogger.Errorw("Failed to set up stderr pipe for the run command",
			"cmd", cs.cmd,
			"error", err,
		)
    o := newStderrResponse(err.Error())
    cs.notifyOut(&o)
	}

  go cs.scanRunCmdOut(stderr, OutTypeStderr)

	if err := cs.cmd.Run(); err != nil {
		slogger.Errorw("Failed to run the run command",
			"cmd", cs.cmd,
			"error", err,
		)
    o := newStderrResponse(err.Error())
    cs.notifyOut(&o)
	}
  cs.cachedOut = nil
}

func (cs *CodeSnippet) Run(code string) CodeSnippetState {
	slogger.Infow("Run code request",
		"code", code,
	)

	cs.mu.Lock()
	if cs.running {
		cs.mu.Unlock()
    slogger.Info("Already running")
		return CodeSnippetStateRunning
	}
	cs.setRunning(true)
	cs.mu.Unlock()

	go cs.runCmd(code)
	return CodeSnippetStateRunning
}

func (cs *CodeSnippet) Stop() CodeSnippetState {
	slogger.Info("Stop code request")

	cs.mu.Lock()
	if !cs.running {
		cs.mu.Unlock()
    slogger.Info("Already stopped")
		return CodeSnippetStateStopped
	}

	sig := syscall.SIGTERM
	if err := cs.cmd.Process.Signal(sig); err != nil {
		slogger.Errorw("Error while sending a signal to the run command",
			"cmd", cs.cmd,
			"signal", sig,
			"error", err,
		)
    o := newStderrResponse(err.Error())
    cs.notifyOut(&o)
	}

  cs.cachedOut = nil

	cs.setRunning(false)
	cs.mu.Unlock()

	return CodeSnippetStateStopped
}

func (cs *CodeSnippet) InstallDep(dep string) (resp ErrResponse) {
  slogger.Infow("Install dep request",
    "dep", dep,
  )

  if err := cs.depsManager.Install(dep); err != nil {
    slogger.Errorw("Error during dep installation",
      "error", err,
    )
    resp.Error = err.Error()
  }

  go cs.notifyDepsChange()

  return resp
}

func (cs *CodeSnippet) UninstallDep(dep string) (resp ErrResponse) {
  slogger.Infow("Uninstall dep request",
    "dep", dep,
  )
  if err := cs.depsManager.Uninstall(dep); err != nil {
    slogger.Errorw("Error during dep uninstallation",
      "error", err,
    )
    resp.Error = err.Error()
  }

  go cs.notifyDepsChange()

  return resp
}

func (cs *CodeSnippet) Deps() []string {
  slogger.Info("Deps list request")
  return cs.depsManager.Deps()
}

// Subscription
func (cs *CodeSnippet) State(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New state subscription")

  sub, err := cs.saveNewSubscriber(ctx, cs.stateSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a state subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

	// Send initial state.
	var state CodeSnippetState
	if cs.running {
		state = CodeSnippetStateRunning
	} else {
		state = CodeSnippetStateStopped
	}
	if err := sub.Notify(state); err != nil {
		slogger.Errorw("Failed to send initial state notification",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)
	}

	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stdout(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New stdout subscription")
	sub, err := cs.saveNewSubscriber(ctx, cs.stdoutSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

  // Send all the cached stdout to a new subscriber.
  for _, l := range cs.cachedOut {
    if l.Type == OutTypeStdout {
      if err := sub.Notify(l); err != nil {
        slogger.Errorw("Failed to send cached stdout notification",
          "subscriptionID", sub.SubscriptionID(),
          "error", err,
        )
      }
    }
  }
	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stderr(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New stderr subscription")
	sub, err := cs.saveNewSubscriber(ctx, cs.stderrSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

  // Send all the cached stdout to a new subscriber.
  for _, l := range cs.cachedOut {
    if l.Type == OutTypeStderr {
      if err := sub.Notify(l); err != nil {
        slogger.Errorw("Failed to send cached stdout notification",
          "subscriptionID", sub.SubscriptionID(),
          "error", err,
        )
      }
    }
  }
	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) DepsChange(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New deps list subscription")
	sub, err := cs.saveNewSubscriber(ctx, cs.depsChangeSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a deps list subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}

  // Send the initial deps.
  if err := sub.Notify(cs.depsManager.Deps()); err != nil {
		slogger.Errorw("Failed to send initial deps",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)
	}

	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) DepsStdout(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New deps stdout subscription")
	sub, err := cs.saveNewSubscriber(ctx, cs.depsStdoutSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a deps stdout subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}
	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) DepsStderr(ctx context.Context) (*rpc.Subscription, error) {
	slogger.Info("New deps stderr subscription")
	sub, err := cs.saveNewSubscriber(ctx, cs.depsStderrSubscribers)
	if err != nil {
		slogger.Errorw("Failed to create a deps stderr subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
	}
	return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) ScanOpenedPorts(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New scan opened ports subscription")
  sub, err := cs.saveNewSubscriber(ctx, cs.scanOpenedPortsSubscribers)
  if err != nil {
		slogger.Errorw("Failed to create a scan opened ports subscription from context",
			"ctx", ctx,
			"error", err,
		)
		return nil, err
  }
  return sub.subscription, nil
}

