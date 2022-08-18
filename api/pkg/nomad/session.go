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
	sessionsJobName          = "fc-sessions"
	sessionsJobNameWithSlash = sessionsJobName + "/"
	sessionsJobFile          = sessionsJobName + jobFileSuffix
	jobRegisterTimeout       = time.Second * 2
	allocationCheckTimeout   = time.Second * 12
	allocationCheckInterval  = time.Millisecond * 100
	fcTaskName               = "start"
	sessionIDPrefix          = "s"
	sessionIDRandomLength    = 7
	shortNodeIDLength        = 8
	nomadTaskRunningState    = "running"
	nomadTaskDeadState       = "dead"
)

func (n *NomadClient) GetSessions() ([]*api.Session, *api.APIError) {
	allocations, _, err := n.client.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", sessionsJobNameWithSlash, fcTaskName, nomadTaskRunningState),
	})
	if err != nil {
		return nil, &api.APIError{
			Msg:       fmt.Sprintf("failed to retrieve allocations from Nomad %+v", err),
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

func (n *NomadClient) CreateSession(newSession *api.NewSession) (*api.Session, *api.APIError) {
	tname := path.Join(templatesDir, sessionsJobFile)
	sessionsJobTemp, err := template.ParseFiles(tname)
	if err != nil {
		return nil, &api.APIError{
			Msg:       fmt.Sprintf("failed to parse template file '%s': %s", tname, err),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	sessionsJobTemp = template.Must(sessionsJobTemp, err)

	var sessionID string
	var evalID string

	var job *nomadAPI.Job

	timeout := time.After(jobRegisterTimeout)

jobRegister:
	for {
		select {
		case <-timeout:
			return nil, &api.APIError{
				Msg:       "failed to find empty sessionID",
				ClientMsg: "Cannot create a session right now",
				Code:      http.StatusInternalServerError,
			}
		default:
			sessionID = sessionIDPrefix + genRandomSession(sessionIDRandomLength)

			var jobDef bytes.Buffer
			jobVars := struct {
				CodeSnippetID string
				SessionID     string
				FCTaskName    string
				JobName       string
				FCEnvsDisk    string
				EditEnabled   bool
			}{
				CodeSnippetID: newSession.CodeSnippetID,
				SessionID:     sessionID,
				FCTaskName:    fcTaskName,
				JobName:       sessionsJobName,
				FCEnvsDisk:    fcEnvsDisk,
				EditEnabled:   *newSession.EditEnabled,
			}

			err = sessionsJobTemp.Execute(&jobDef, jobVars)
			if err != nil {
				return nil, &api.APIError{
					Msg:       fmt.Sprintf("failed to `sessionsJobTemp.Execute()`: %+v", err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
			}

			job, err = n.client.Jobs().ParseHCL(jobDef.String(), false)
			if err != nil {
				return nil, &api.APIError{
					Msg:       fmt.Sprintf("failed to parse the `%s` HCL job file: %+v", sessionsJobFile, err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
			}

			res, _, err := n.client.Jobs().EnforceRegister(job, 0, &nomadAPI.WriteOptions{})
			if err != nil {
				fmt.Printf("Failed to register '%s%s' job: %+v", sessionsJobNameWithSlash, jobVars.SessionID, err)
				continue
			}
			evalID = res.EvalID
			break jobRegister
		}
	}

	timeout = time.After(allocationCheckTimeout)
	var allocErr *api.APIError

allocationCheck:
	for {
		select {
		case <-timeout:
			allocErr = &api.APIError{
				Msg:       fmt.Sprintf("cannot retrieve allocations for '%s%s' job: Timeout - %s", sessionsJobNameWithSlash, sessionID, allocationCheckTimeout.String()),
				ClientMsg: "Cannot create a session right now - timeout",
				Code:      http.StatusInternalServerError,
			}
			break allocationCheck
		default:
			allocs, _, err := n.client.Evaluations().Allocations(evalID, &nomadAPI.QueryOptions{})
			if err != nil {
				allocErr = &api.APIError{
					Msg:       fmt.Sprintf("cannot retrieve allocations for '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
				break allocationCheck
			}

			for _, alloc := range allocs {
				if alloc.TaskStates[fcTaskName] == nil {
					continue
				}

				if alloc.TaskStates[fcTaskName].State == nomadTaskDeadState {
					msgStruct, _ := json.Marshal(newSession)
					allocErr = &api.APIError{
						Msg:       fmt.Sprintf("allocation is %s for '%s%s' job", alloc.TaskStates[fcTaskName].State, sessionsJobNameWithSlash, sessionID),
						ClientMsg: fmt.Sprintf("Session couldn't be started: the problem may be in the request's payload - is the 'codeSnippetID' valid?: %+v", string(msgStruct)),
						Code:      http.StatusBadRequest,
					}
					break allocationCheck
				}

				if alloc.TaskStates[fcTaskName].State == nomadTaskRunningState {
					session := &api.Session{
						ClientID:      alloc.NodeID[:shortNodeIDLength],
						SessionID:     sessionID,
						CodeSnippetID: newSession.CodeSnippetID,
						EditEnabled:   *newSession.EditEnabled,
					}

					return session, nil
				}
				continue
			}
		}
		time.Sleep(allocationCheckInterval)
	}

	apiErr := n.DeleteSession(sessionID, false)
	if apiErr != nil {
		fmt.Printf("error in cleanup after failing to create session for code snippet '%s':%+v", newSession.CodeSnippetID, apiErr.Msg)
	}

	return nil, allocErr
}

func (n *NomadClient) DeleteSession(sessionID string, purge bool) *api.APIError {
	_, _, err := n.client.Jobs().Deregister(sessionsJobNameWithSlash+sessionID, purge, &nomadAPI.WriteOptions{})
	if err != nil {
		return &api.APIError{
			Msg:       fmt.Sprintf("cannot delete job '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
			ClientMsg: "Cannot delete the session right now",
			Code:      http.StatusInternalServerError,
		}
	}
	return nil
}
