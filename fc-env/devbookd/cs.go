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
	"go.uber.org/zap"
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
		Type:      OutTypeStdout,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
	}
}

func newStderrResponse(line string) OutResponse {
	return OutResponse{
		Type:      OutTypeStderr,
		Line:      line,
		Timestamp: time.Now().UnixNano(),
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

type CodeSnippetService struct {
	cmd     *exec.Cmd
	mu      sync.Mutex
	running bool

	logger *zap.SugaredLogger

	// The reason for caching cmd's outputs is if a client connects while the command
	// is already running we can send all the output that has happened since the start
	// of the command.
	// This way a user on the frontend doesn't even notice that command has been running.
	cachedOut []OutResponse

	subscribersLock sync.RWMutex

	stdoutSubscribers          map[rpc.ID]*subscriber
	stderrSubscribers          map[rpc.ID]*subscriber
	stateSubscribers           map[rpc.ID]*subscriber
	scanOpenedPortsSubscribers map[rpc.ID]*subscriber
}

func NewCodeSnippetService(logger *zap.SugaredLogger) *CodeSnippetService {
	cs := &CodeSnippetService{
		logger:                     logger,
		stdoutSubscribers:          make(map[rpc.ID]*subscriber),
		stderrSubscribers:          make(map[rpc.ID]*subscriber),
		stateSubscribers:           make(map[rpc.ID]*subscriber),
		scanOpenedPortsSubscribers: make(map[rpc.ID]*subscriber),
	}
	go cs.scanTCPPorts()
	return cs
}

func (cs *CodeSnippetService) saveNewSubscriber(ctx context.Context, subs map[rpc.ID]*subscriber) (*subscriber, error) {
	sub, err := newSubscriber(ctx)
	if err != nil {
		return nil, err
	}

	// Watch for subscription errors.
	go func() {
		err := <-sub.subscription.Err()
		cs.logger.Errorw("Subscribtion error",
			"subscriptionID", sub.SubscriptionID(),
			"error", err,
		)

		cs.removeSubscriber(subs, sub.SubscriptionID())
	}()

	cs.subscribersLock.Lock()
	defer cs.subscribersLock.Unlock()

	subs[sub.SubscriptionID()] = sub
	return sub, nil
}

func (cs *CodeSnippetService) removeSubscriber(subs map[rpc.ID]*subscriber, subscriberID rpc.ID) {
	cs.subscribersLock.Lock()
	defer cs.subscribersLock.Unlock()

	delete(subs, subscriberID)
}

func (cs *CodeSnippetService) getSubscribers(subs map[rpc.ID]*subscriber) []*subscriber {
	subscribersList := []*subscriber{}

	cs.subscribersLock.RLock()
	defer cs.subscribersLock.RUnlock()

	for _, s := range subs {
		subscribersList = append(subscribersList, s)
	}

	return subscribersList
}

func (cs *CodeSnippetService) setRunning(b bool) {
	cs.running = b
	var state CodeSnippetState
	if b {
		state = CodeSnippetStateRunning
	} else {
		state = CodeSnippetStateStopped
	}
	cs.notifyState(state)
}

func (cs *CodeSnippetService) scanTCPPorts() {
	ticker := time.NewTicker(1 * time.Second)

	for range ticker.C {
		d := GOnetstat.Tcp()
		cs.notifyScanOpenedPorts(d)
	}
}

func (cs *CodeSnippetService) notifyScanOpenedPorts(ports []GOnetstat.Process) {
	for _, sub := range cs.getSubscribers(cs.scanOpenedPortsSubscribers) {
		if err := sub.Notify(ports); err != nil {
			slogger.Errorw("Failed to send scan opened ports notification",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
		}
	}
}

func (cs *CodeSnippetService) notifyOut(o *OutResponse) {
	switch o.Type {
	case OutTypeStdout:
		for _, sub := range cs.getSubscribers(cs.stdoutSubscribers) {
			if err := sub.Notify(o); err != nil {
				slogger.Errorw("Failed to send stdout notification",
					"subscriptionID", sub.SubscriptionID(),
					"error", err,
				)
			}
		}
	case OutTypeStderr:
		for _, sub := range cs.getSubscribers(cs.stderrSubscribers) {
			if err := sub.Notify(o); err != nil {
				slogger.Errorw("Failed to send stderr notification",
					"subscriptionID", sub.SubscriptionID(),
					"error", err,
				)
			}
		}
	}
}

func (cs *CodeSnippetService) notifyState(state CodeSnippetState) {
	for _, sub := range cs.getSubscribers(cs.stateSubscribers) {
		if err := sub.Notify(state); err != nil {
			slogger.Errorw("Failed to send state notification",
				"subscriptionID", sub.SubscriptionID(),
				"error", err,
			)
		}
	}
}

func (cs *CodeSnippetService) scanRunCmdOut(pipe io.ReadCloser, t outType) {
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

	cs.mu.Lock()
	if cs.running {
		cs.cmd.Wait()
		cs.cachedOut = nil
		cs.setRunning(false)
	}
	cs.mu.Unlock()
}

func (cs *CodeSnippetService) runCmd(code string, envVars *map[string]string) {
	if err := os.WriteFile(entrypointFullPath, []byte(code), 0755); err != nil {
		slogger.Errorw("Failed to write to the entrypoint file",
			"entrypointFullPath", entrypointFullPath,
			"error", err,
		)
	}

	cmdToExecute := runCmd

	for _, arg := range parsedRunArgs {
		cmdToExecute = cmdToExecute + " " + arg
	}

	cs.cmd = exec.Command("sh", "-c", "-l", cmdToExecute)
	cs.cmd.Dir = workdir

	formattedVars := os.Environ()

	for key, value := range *envVars {
		formattedVars = append(formattedVars, key+"="+value)
	}

	cs.cmd.Env = formattedVars

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

	if err := cs.cmd.Start(); err != nil {
		slogger.Errorw("Failed to run the run command",
			"cmd", cs.cmd,
			"error", err,
		)
		o := newStderrResponse(err.Error())
		cs.notifyOut(&o)
		cs.cachedOut = nil
	}
}

func (cs *CodeSnippetService) Run(code string, envVars map[string]string) CodeSnippetState {
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

	go cs.runCmd(code, &envVars)
	return CodeSnippetStateRunning
}

func (cs *CodeSnippetService) Stop() CodeSnippetState {
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

// Subscription
func (cs *CodeSnippetService) State(ctx context.Context) (*rpc.Subscription, error) {
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
func (cs *CodeSnippetService) Stdout(ctx context.Context) (*rpc.Subscription, error) {
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
func (cs *CodeSnippetService) Stderr(ctx context.Context) (*rpc.Subscription, error) {
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
func (cs *CodeSnippetService) ScanOpenedPorts(ctx context.Context) (*rpc.Subscription, error) {
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
