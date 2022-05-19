package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"
	"time"

	nomadAPI "github.com/hashicorp/nomad/api"
)

const SessionsJobName = "firecracker-sessions"
const SessionsJobFile = SessionsJobName + ".hcl"

type SessionInfo struct {
	ClientID  string
	SessionID string
}

func (n *Nomad) GetSessions() ([]*nomadAPI.JobListStub, *nomadAPI.QueryMeta, error) {
	return n.nomadClient.Jobs().PrefixList(SessionsJobName)
}

func (n *Nomad) CreateSession(codeSnippetID string) (*SessionInfo, error) {
	tname := path.Join(templatesDir, SessionsJobFile)
	sessionsJobTemp, err := template.New(SessionsJobFile).Funcs(
		template.FuncMap{
			"escapeNewLines": escapeNewLines,
		},
	).ParseFiles(tname)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	sessionsJobTemp = template.Must(sessionsJobTemp, err)

	sessionID := "s" + genRandom(7)
	jobVars := struct {
		CodeSnippetID string
		SessionID     string
	}{
		CodeSnippetID: codeSnippetID,
		SessionID:     sessionID,
	}
	var jobDef bytes.Buffer
	if err := sessionsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return nil, fmt.Errorf("Failed to `sessionsJobTemp.Execute()`: %s", err)
	}

	job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse the `firecracker-sessions` HCL job file: %s", err)
	}

	res, _, err := n.nomadClient.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return nil, fmt.Errorf("Failed to register 'firecracker-sessions/%s' job: %s", jobVars.SessionID, err)
	}

	ticker := time.NewTicker(time.Millisecond * 100)

	timeout := time.Second * 120

	timer := time.NewTimer(timeout)

	go func() {
		<-timer.C
		ticker.Stop()
	}()

	for ; true; <-ticker.C {
		allocs, _, err := n.nomadClient.Evaluations().Allocations(res.EvalID, &nomadAPI.QueryOptions{})
		if err != nil {
			return nil, fmt.Errorf("Cannot retrieve allocations for 'firecracker-sessions/%s' job: %s", jobVars.SessionID, err)
		}

		for _, alloc := range allocs {
			session := &SessionInfo{
				ClientID:  alloc.NodeID[:8],
				SessionID: sessionID,
			}
			return session, nil
		}
	}

	return nil, fmt.Errorf("Cannot retrieve allocations for 'firecracker-sessions/%s' job: Timeout - %s", jobVars.SessionID, timeout.String())
}

func (n *Nomad) DeleteSession(sessionID string) (bool, error) {
	_, _, err := n.nomadClient.Jobs().Deregister(SessionsJobName+"/"+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return false, fmt.Errorf("Cannot delete job 'firecracker-sessions/%s' job: %s", sessionID, err)
	}
	return true, nil
}
