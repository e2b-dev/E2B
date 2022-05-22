package nomad

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"text/template"
	"time"

	"github.com/devbookhq/orchestration-services/api/internal/api"
	nomadAPI "github.com/hashicorp/nomad/api"
)

const (
	sessionsJobName          = "firecracker-sessions"
	sessionsJobNameWithSlash = sessionsJobName + "/"
	sessionsJobFile          = sessionsJobName + ".hcl"
	allocationCheckTimeout   = time.Second * 10
	allocationCheckInterval  = time.Millisecond * 80
	fcTaskName               = "start"
	sessionIDPrefix          = "s"
	sessionIDTotalLength     = 8
	shortNodeIDLength        = 8
	nomadTaskRunningState    = "running"
	nomadTaskFailedState     = "dead"
)

type APIError struct {
	Msg       string
	ClientMsg string
	Code      int
}

func (err *APIError) Error() string {
	return err.Msg
}

func (n *Nomad) GetSessions() ([]*api.Session, *APIError) {
	allocations, _, err := n.nomadClient.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", sessionsJobNameWithSlash, fcTaskName, nomadTaskRunningState),
	})
	if err != nil {
		return nil, &APIError{
			Msg:       fmt.Sprintf("Failed to retrieve allocations from Nomad %+v", err),
			ClientMsg: "Cannot retrieve sessions right now",
			Code:      http.StatusInternalServerError,
		}
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

func (n *Nomad) CreateSession(newSession *api.NewSession) (*api.Session, *APIError) {
	tname := path.Join(templatesDir, sessionsJobFile)
	sessionsJobTemp, err := template.New(sessionsJobFile).Funcs(
		template.FuncMap{
			"escapeNewLines": escapeNewLines,
		},
	).ParseFiles(tname)
	if err != nil {
		return nil, &APIError{
			Msg:       fmt.Sprintf("Failed to parse template file '%s': %s", tname, err),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
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
		return nil, &APIError{
			Msg:       fmt.Sprintf("Failed to `sessionsJobTemp.Execute()`: %+v", err),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	job, err := n.nomadClient.Jobs().ParseHCL(jobDef.String(), false)
	if err != nil {
		return nil, &APIError{
			Msg:       fmt.Sprintf("Failed to parse the `%s` HCL job file: %+v", sessionsJobFile, err),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	res, _, err := n.nomadClient.Jobs().Register(job, &nomadAPI.WriteOptions{})
	if err != nil {
		return nil, &APIError{
			Msg:       fmt.Sprintf("Failed to register '%s%s' job: %+v", sessionsJobNameWithSlash, jobVars.SessionID, err),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	timeout := time.After(allocationCheckTimeout)

allocationCheck:
	for {
		select {
		case <-timeout:
			break allocationCheck
		default:
			allocs, _, err := n.nomadClient.Evaluations().Allocations(res.EvalID, &nomadAPI.QueryOptions{})
			if err != nil {
				return nil, &APIError{
					Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: %+v", sessionsJobNameWithSlash, jobVars.SessionID, err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
			}

			for _, alloc := range allocs {
				if alloc.TaskStates[fcTaskName] == nil {
					continue
				}

				if alloc.TaskStates[fcTaskName].State == nomadTaskFailedState {
					msgStruct, _ := json.Marshal(newSession)
					return nil, &APIError{
						Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: %+v", sessionsJobNameWithSlash, jobVars.SessionID, err),
						ClientMsg: fmt.Sprintf("Session couldn't be started: the problem may be in the request's payload - is the 'codeSnippetID' valid?: %+v", string(msgStruct)),
						Code:      http.StatusBadRequest,
					}
				}
				fmt.Printf(alloc.TaskStates[fcTaskName].State)

				if alloc.TaskStates[fcTaskName].State == nomadTaskRunningState {
					return &api.Session{
						ClientID:  alloc.NodeID[:shortNodeIDLength],
						SessionID: sessionID,
					}, nil
				}
				continue
			}
		}
		time.Sleep(allocationCheckInterval)
	}

	return nil, &APIError{
		Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: Timeout - %s", sessionsJobNameWithSlash, jobVars.SessionID, allocationCheckTimeout.String()),
		ClientMsg: "Cannot create a session right now - timeout",
		Code:      http.StatusInternalServerError,
	}
}

func (n *Nomad) DeleteSession(sessionID string) *APIError {
	_, _, err := n.nomadClient.Jobs().Deregister(sessionsJobNameWithSlash+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return &APIError{
			Msg:       fmt.Sprintf("Cannot delete job '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
			ClientMsg: "Cannot delete the session right now",
			Code:      500,
		}
	}
	return nil
}
