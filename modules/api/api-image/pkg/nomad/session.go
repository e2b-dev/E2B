package nomad

import (
	"bytes"
	"fmt"
	"path"
	"text/template"
	"time"

	"github.com/devbookhq/orchestration-services/modules/api/api-image/internal/api"
	nomadAPI "github.com/hashicorp/nomad/api"
)

const (
	sessionsJobName          = "firecracker-sessions"
	sessionsJobNameWithSlash = sessionsJobName + "/"
	sessionsJobFile          = sessionsJobName + ".hcl"
	allocationCheckTimeout   = time.Second * 60
	allocationCheckInterval  = time.Millisecond * 100
	fcTaskName               = "start"
	sessionIDPrefix          = "s"
	sessionIDTotalLength     = 8
	shortNodeIDLength        = 8
	nomadTaskRunningState    = "running"
)

func (n *Nomad) GetSessions() ([]*api.Session, error) {
	allocations, _, err := n.nomadClient.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", sessionsJobNameWithSlash, fcTaskName, nomadTaskRunningState),
	})
	if err != nil {
		return nil, fmt.Errorf("Failed to retrieve allocations from Nomad %v", err)
	}

	sessions := []*api.Session{}

	for _, alloc := range allocations {
		sessions = append(sessions, &api.Session{
			ClientID:  alloc.NodeID[:shortNodeIDLength],
			SessionID: alloc.JobID[len(sessionsJobNameWithSlash):],
		})
	}

	return sessions, nil
}

func (n *Nomad) CreateSession(newSession *api.NewSession) (*api.Session, error) {
	tname := path.Join(templatesDir, sessionsJobFile)
	sessionsJobTemp, err := template.New(sessionsJobFile).Funcs(
		template.FuncMap{
			"escapeNewLines": escapeNewLines,
		},
	).ParseFiles(tname)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse template file '%s': %s", tname, err)
	}

	sessionsJobTemp = template.Must(sessionsJobTemp, err)

	sessionID := sessionIDPrefix + genRandom(sessionIDTotalLength-1)
	jobVars := struct {
		CodeSnippetID  string
		SessionID      string
		FCTaskName     string
		SessionJobName string
	}{
		CodeSnippetID:  newSession.CodeSnippetID,
		SessionID:      sessionID,
		FCTaskName:     fcTaskName,
		SessionJobName: sessionsJobName,
	}
	var jobDef bytes.Buffer
	if err := sessionsJobTemp.Execute(&jobDef, jobVars); err != nil {
		return nil, fmt.Errorf("Failed to `sessionsJobTemp.Execute()`: %v", err)
	}

	job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse the `%s` HCL job file: %v", sessionsJobFile, err)
	}

	res, _, err := n.nomadClient.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return nil, fmt.Errorf("Failed to register '%s%s' job: %v", sessionsJobNameWithSlash, jobVars.SessionID, err)
	}

	ticker := time.NewTicker(allocationCheckInterval)
	timer := time.NewTimer(allocationCheckTimeout)

	go func() {
		<-timer.C
		ticker.Stop()
	}()

	for ; true; <-ticker.C {
		allocs, _, err := n.nomadClient.Evaluations().Allocations(res.EvalID, &nomadAPI.QueryOptions{})
		if err != nil {
			return nil, fmt.Errorf("Cannot retrieve allocations for '%s%s' job: %v", sessionsJobNameWithSlash, jobVars.SessionID, err)
		}

		for _, alloc := range allocs {
			session := &api.Session{
				ClientID:  alloc.NodeID[:shortNodeIDLength],
				SessionID: sessionID,
			}
			return session, nil
		}
	}

	return nil, fmt.Errorf("Cannot retrieve allocations for '%s%s' job: Timeout - %s", sessionsJobNameWithSlash, jobVars.SessionID, allocationCheckTimeout.String())
}

func (n *Nomad) DeleteSession(sessionID string) error {
	_, _, err := n.nomadClient.Jobs().Deregister(sessionsJobNameWithSlash+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return fmt.Errorf("Cannot delete job '%s%s' job: %v", sessionsJobNameWithSlash, sessionID, err)
	}
	return nil
}
