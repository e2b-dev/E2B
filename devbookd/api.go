package main

import (
	"bufio"
	"context"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/ethereum/go-ethereum/rpc"
)

// TODO: I'm not really sure if we're using RPC Notifier and Subscriber in the right way.
// There isn't an explicit documentation, I'm using source code of tests as a reference:
// https://cs.github.com/ethereum/go-ethereum/blob/440c9fcf75d9d5383b72646a65d5e21fa7ab6a26/rpc/testservice_test.go#L160

func createSubscription(ctx context.Context) (*rpc.Notifier, *rpc.Subscription, error){
  notifier, support := rpc.NotifierFromContext(ctx)
  if !support {
    return nil, nil, rpc.ErrNotificationsUnsupported
  }

	subscription := notifier.CreateSubscription()
  return notifier, subscription, nil
}

type CodeSnippet struct {
  cmd *exec.Cmd
  mu  sync.Mutex
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
    log.Println(err)
  }
}

func (cs *CodeSnippet) notifyStderr(s string) {
  if err := cs.stderrNotifier.Notify(cs.stderrSubscriberID, s); err != nil {
    log.Println(err)
  }
}

func (cs *CodeSnippet) notifyState(state string) {
  if err := cs.stateNotifier.Notify(cs.stateSubscriberID, state); err != nil {
    log.Println(err)
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

  err := os.WriteFile("./test/index.js", []byte(code), 0644)
  if err != nil {
    panic(err)
  }

  cs.cmd = exec.Command("node", "./index.js")
  cs.cmd.Dir = "./test"

  stdout, err := cs.cmd.StdoutPipe()
  if err != nil {
    log.Println(err)
    cs.notifyStderr(err.Error())
  }
  stderr, err := cs.cmd.StderrPipe()
  if err != nil {
    log.Println(err)
    cs.notifyStderr(err.Error())
  }

  go cs.scanStdout(stdout)
  go cs.scanStderr(stderr)

  if err := cs.cmd.Run(); err != nil {
    log.Println(err)
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

  if err := cs.cmd.Process.Signal(syscall.SIGTERM); err != nil {
    log.Println(err)
    cs.notifyStderr(err.Error())
  }

  cs.setRunning(false)
  cs.mu.Unlock()

  return "stopped"
}

// Subscription
func (cs *CodeSnippet) State(ctx context.Context) (*rpc.Subscription, error) {
  log.Println("State subscription")
  notifier, subscription, err := createSubscription(ctx)
  if err != nil {
    log.Println(err)
    return nil, err
  }
  cs.stateNotifier = notifier
  cs.stateSubscriberID = subscription.ID
  return subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stdout(ctx context.Context) (*rpc.Subscription, error) {
  log.Println("Stdout subscription")
  notifier, subscription, err := createSubscription(ctx)
  if err != nil {
    log.Println(err)
    return nil, err
  }
  cs.stdoutNotifier = notifier
  cs.stdoutSubscriberID = subscription.ID
  return subscription, nil
}

// Subscription
func (cs *CodeSnippet) Stderr(ctx context.Context) (*rpc.Subscription, error) {
  log.Println("Stderr subscription")
  notifier, subscription, err := createSubscription(ctx)
  if err != nil {
    log.Println(err)
    return nil, err
  }
  cs.stderrNotifier = notifier
  cs.stderrSubscriberID = subscription.ID
  return subscription, nil
}
