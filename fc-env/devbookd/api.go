package main

import (
	"bufio"
	"context"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/ethereum/go-ethereum/rpc"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

type CodeSnippet struct {
	cmd     *exec.Cmd
	mu      sync.Mutex
	running bool

  stdoutSubscribers map[rpc.ID]*subscriber
  stderrSubscribers map[rpc.ID]*subscriber
  stateSubscribers  map[rpc.ID]*subscriber
}

func NewCodeSnippetService() *CodeSnippet {
  return &CodeSnippet{
    stdoutSubscribers: make(map[rpc.ID]*subscriber),
    stderrSubscribers: make(map[rpc.ID]*subscriber),
    stateSubscribers: make(map[rpc.ID]*subscriber),
  }
}

func (cs *CodeSnippet) setRunning(b bool) {
	cs.running = b
	var state string
	if b {
		state = "running"
	} else {
		state = "stopped"
	}
	cs.notifyState(state)
}

func (cs *CodeSnippet) notifyStdout(s string) {
  for _, sub := range cs.stdoutSubscribers {
    if err := sub.Notify(s); err != nil {
      slogger.Errorw("Failed to send stdout notification",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
    }
  }
}

func (cs *CodeSnippet) notifyStderr(s string) {
  for _, sub := range cs.stderrSubscribers {
    if err := sub.Notify(s); err != nil {
      slogger.Errorw("Failed to send stderr notification",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
    }
  }
}

func (cs *CodeSnippet) notifyState(state string) {
  for _, sub := range cs.stateSubscribers {
    if err := sub.Notify(state); err != nil {
      slogger.Errorw("Failed to send state notification",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
    }
  }
}

func (cs *CodeSnippet) scanStdout(pipe io.ReadCloser) {
	scanner := bufio.NewScanner(pipe)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		cs.notifyStdout(scanner.Text())
	}
}

func (cs *CodeSnippet) scanStderr(pipe io.ReadCloser) {
	scanner := bufio.NewScanner(pipe)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		cs.notifyStderr(scanner.Text())
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
		cs.notifyStderr(err.Error())
	}
	stderr, err := cs.cmd.StderrPipe()
	if err != nil {
    slogger.Errorw("Failed to set up stderr pipe for the run command",
      "cmd", cs.cmd,
      "error", err,
    )
		cs.notifyStderr(err.Error())
	}

	go cs.scanStdout(stdout)
	go cs.scanStderr(stderr)

	if err := cs.cmd.Run(); err != nil {
    slogger.Errorw("Failed to run the run command",
      "cmd", cs.cmd,
      "error", err,
    )
		cs.notifyStderr(err.Error())
	}
}

func (cs *CodeSnippet) Run(code string) string {
	cs.mu.Lock()
	if cs.running {
		cs.mu.Unlock()
		return "running"
	}
	cs.setRunning(true)
	cs.mu.Unlock()

	go cs.runCmd(code)
	return "running"
}

func (cs *CodeSnippet) Stop() string {
	cs.mu.Lock()
	if !cs.running {
		cs.mu.Unlock()
		return "stopped"
	}

  sig := syscall.SIGTERM
	if err := cs.cmd.Process.Signal(sig); err != nil {
    slogger.Errorw("Error while sending a signal to the run command",
      "cmd", cs.cmd,
      "signal", sig,
      "error", err,
    )
		cs.notifyStderr(err.Error())
	}

	cs.setRunning(false)
	cs.mu.Unlock()

	return "stopped"
}

// Subscription
func (cs *CodeSnippet) State(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New state subscription")
	sub, err := newSubscriber(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a state subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}

  // Watch for subscription errors.
  go func() {
    select {
    case err := <-sub.subscription.Err():
      slogger.Infow("State subscribtion error",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
      delete(cs.stateSubscribers, sub.SubscriptionID())
    }
  }()

  cs.stateSubscribers[sub.SubscriptionID()] = sub
  return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stdout(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New stdout subscription")
	sub, err := newSubscriber(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a stdout subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}

  // Watch for subscription errors.
  go func() {
    select {
    case err := <-sub.subscription.Err():
      slogger.Infow("Stdout subscribtion error",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
      delete(cs.stdoutSubscribers, sub.SubscriptionID())
    }
  }()

  cs.stdoutSubscribers[sub.SubscriptionID()] = sub
  return sub.subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stderr(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New stderr subscription")
	sub, err := newSubscriber(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a stderr subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}

  // Watch for subscription errors.
  go func() {
    select {
    case err := <-sub.subscription.Err():
      slogger.Infow("Stderr subscribtion error",
        "subscriptionID", sub.SubscriptionID(),
        "error", err,
      )
      delete(cs.stderrSubscribers, sub.SubscriptionID())
    }
  }()

  cs.stderrSubscribers[sub.SubscriptionID()] = sub
  return sub.subscription, nil
}
