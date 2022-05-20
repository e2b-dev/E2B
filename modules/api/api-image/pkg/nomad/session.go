package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"
	"time"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/handlers"
	nomadAPI "github.com/hashicorp/nomad/api"
)

const (
	SessionsJobName         = "firecracker-sessions"
	SessionsJobFile         = SessionsJobName + ".hcl"
	AllocationCheckTimeout  = time.Second * 60
	AllocationCheckInterval = time.Millisecond * 100
)

func (n *Nomad) GetSessions() ([]*handlers.Session, error) {
	sessionPrefix := SessionsJobName + "/"

	sessionsJobs, _, err := n.nomadClient.Jobs().PrefixList(sessionPrefix)
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve all sessions %s", err)
	}

	sessions := []*handlers.Session{}

	for _, job := range sessionsJobs {
		if job.Status == "running" {
			allocations, _, err := n.nomadClient.Jobs().Allocations(job.ID, false, &nomadAPI.QueryOptions{})
			if err != nil {
				return nil, fmt.Errorf("Failed to retrieve job allocations %s: %v", job.ID, err)
			}
			for _, alloc := range allocations {
				sessions = append(sessions, &handlers.Session{
					ClientId:  alloc.NodeID[len(sessionPrefix):],
					SessionId: job.ID,
				})
			}
		}
	}

	return sessions, nil
}

func (n *Nomad) CreateSession(form *handlers.SessionForm) (*handlers.Session, error) {

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
		CodeSnippetID: form.CodeSnippetId,
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

	ticker := time.NewTicker(AllocationCheckInterval)
	timer := time.NewTimer(AllocationCheckTimeout)

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
			session := &handlers.Session{
				ClientId:  alloc.NodeID[:8],
				SessionId: sessionID,
			}
			return session, nil
		}
	}

	return nil, fmt.Errorf("Cannot retrieve allocations for 'firecracker-sessions/%s' job: Timeout - %s", jobVars.SessionID, AllocationCheckTimeout.String())
}

func (n *Nomad) DeleteSession(sessionID string) error {
	_, _, err := n.nomadClient.Jobs().Deregister(SessionsJobName+"/"+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("Cannot delete job 'firecracker-sessions/%s' job: %s", sessionID, err)
	}
	return nil
}
