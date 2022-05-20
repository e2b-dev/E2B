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
	SessionsJobName          = "firecracker-sessions"
	SessionsJobNameWithSlash = SessionsJobName + "/"
	SessionsJobFile          = SessionsJobName + ".hcl"
	AllocationCheckTimeout   = time.Second * 60
	AllocationCheckInterval  = time.Millisecond * 100
	FCTaskName               = "start"
	SessionIDPrefix          = "s"
	SessionIDTotalLength     = 8
	ShortNodeIDLength        = 8
	NomadTaskRunningState    = "running"
)

func (n *Nomad) GetSessions() ([]*handlers.Session, error) {
	allocations, _, err := n.nomadClient.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", SessionsJobNameWithSlash, FCTaskName, NomadTaskRunningState),
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve sessions' allocations %s: %v", err)
	}

	sessions := []*handlers.Session{}

	for _, alloc := range allocations {
		sessions = append(sessions, &handlers.Session{
			ClientId:  alloc.NodeID[:ShortNodeIDLength],
			SessionId: alloc.JobID[len(SessionsJobNameWithSlash):],
		})
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

	sessionID := SessionIDPrefix + genRandom(SessionIDTotalLength-1)
	jobVars := struct {
		CodeSnippetID  string
		SessionID      string
		FCTaskName     string
		SessionJobName string
	}{
		CodeSnippetID:  form.CodeSnippetId,
		SessionID:      sessionID,
		FCTaskName:     FCTaskName,
		SessionJobName: SessionsJobName,
	}
	var jobDef bytes.Buffer
	if err := sessionsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return nil, fmt.Errorf("Failed to `sessionsJobTemp.Execute()`: %v", err)
	}

	job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse the `%s` HCL job file: %v", SessionsJobFile, err)
	}

	res, _, err := n.nomadClient.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return nil, fmt.Errorf("Failed to register '%s%s' job: %v", SessionsJobNameWithSlash, jobVars.SessionID, err)
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
			return nil, fmt.Errorf("Cannot retrieve allocations for '%s%s' job: %v", SessionsJobNameWithSlash, jobVars.SessionID, err)
		}

		for _, alloc := range allocs {
			session := &handlers.Session{
				ClientId:  alloc.NodeID[:ShortNodeIDLength],
				SessionId: sessionID,
			}
			return session, nil
		}
	}

	return nil, fmt.Errorf("Cannot retrieve allocations for '%s%s' job: Timeout - %s", SessionsJobNameWithSlash, jobVars.SessionID, AllocationCheckTimeout.String())
}

func (n *Nomad) DeleteSession(sessionID string) error {
	_, _, err := n.nomadClient.Jobs().Deregister(SessionsJobNameWithSlash+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("Cannot delete job '%s%s' job: %v", SessionsJobNameWithSlash, sessionID, err)
	}
	return nil
}
