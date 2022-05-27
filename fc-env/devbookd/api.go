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

func createSubscription(ctx context.Context) (*rpc.Notifier, *rpc.Subscription, error) {
	notifier, support := rpc.NotifierFromContext(ctx)
	if !support {
		return nil, nil, rpc.ErrNotificationsUnsupported
	}

	subscription := notifier.CreateSubscription()
	return notifier, subscription, nil
}

type CodeSnippet struct {
	cmd     *exec.Cmd
	mu      sync.Mutex
	running bool

	stdoutNotifier     *rpc.Notifier
	stdoutSubscriberID rpc.ID

	stderrNotifier     *rpc.Notifier
	stderrSubscriberID rpc.ID

	stateNotifier     *rpc.Notifier
	stateSubscriberID rpc.ID
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
	if err := cs.stdoutNotifier.Notify(cs.stdoutSubscriberID, s); err != nil {
    slogger.Errorw("Failed to send stdout notification",
      "subscriberID", cs.stdoutSubscriberID,
      "error", err,
    )
	}
}

func (cs *CodeSnippet) notifyStderr(s string) {
	if err := cs.stderrNotifier.Notify(cs.stderrSubscriberID, s); err != nil {
    slogger.Errorw("Failed to send stderr notification",
      "subscriberID", cs.stderrSubscriberID,
      "error", err,
    )
	}
}

func (cs *CodeSnippet) notifyState(state string) {
	if err := cs.stateNotifier.Notify(cs.stateSubscriberID, state); err != nil {
    slogger.Errorw("Failed to send state notification",
      "subscriberID", cs.stateSubscriberID,
      "error", err,
    )
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
	notifier, subscription, err := createSubscription(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a state subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}
	cs.stateNotifier = notifier
	cs.stateSubscriberID = subscription.ID
	return subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stdout(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New stdout subscription")
	notifier, subscription, err := createSubscription(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a stdout subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}
	cs.stdoutNotifier = notifier
	cs.stdoutSubscriberID = subscription.ID
	return subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stderr(ctx context.Context) (*rpc.Subscription, error) {
  slogger.Info("New stderr subscription")
	notifier, subscription, err := createSubscription(ctx)
	if err != nil {
    slogger.Errorw("Failed to create a stderr subscription from context",
      "ctx", ctx,
      "error", err,
    )
		return nil, err
	}
	cs.stderrNotifier = notifier
	cs.stderrSubscriberID = subscription.ID
	return subscription, nil
}
