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
	jobRegisterTimeout       = time.Second * 10
	allocationCheckTimeout   = time.Second * 10
	allocationCheckInterval  = time.Millisecond * 80
	fcTaskName               = "start"
	sessionIDPrefix          = "s"
	sessionIDRandomLength    = 7
	shortNodeIDLength        = 8
	nomadTaskRunningState    = "running"
	nomadTaskFailedState     = "dead"
)

func (n *NomadClient) GetSessions() ([]*api.Session, *api.APIError) {
	allocations, _, err := n.client.Allocations().List(&nomadAPI.QueryOptions{
		Filter: fmt.Sprintf("JobID contains \"%s\" and TaskStates.%s.State == \"%s\"", sessionsJobNameWithSlash, fcTaskName, nomadTaskRunningState),
	})
	if err != nil {
		return nil, &api.APIError{
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

func (n *NomadClient) CreateSession(newSession *api.NewSession) (*api.Session, *api.APIError) {
	tname := path.Join(templatesDir, sessionsJobFile)
	sessionsJobTemp, err := template.ParseFiles(tname)
	if err != nil {
		return nil, &api.APIError{
			Msg:       fmt.Sprintf("Failed to parse template file '%s': %s", tname, err),
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
				Msg:       "Failed to find empty sessionID",
				ClientMsg: "Cannot create a session right now",
				Code:      http.StatusInternalServerError,
			}
		default:
			sessionID = sessionIDPrefix + genRandomSession(sessionIDRandomLength)

			var jobDef bytes.Buffer
			jobVars := struct {
				CodeSnippetID  string
				SessionID      string
				FCTaskName     string
				SessionJobName string
				FCEnvsDisk     string
			}{
				CodeSnippetID:  newSession.CodeSnippetID,
				SessionID:      sessionID,
				FCTaskName:     fcTaskName,
				SessionJobName: sessionsJobName,
				FCEnvsDisk:     fcEnvsDisk,
			}

			err = sessionsJobTemp.Execute(&jobDef, jobVars)
			if err != nil {
				return nil, &api.APIError{
					Msg:       fmt.Sprintf("Failed to `sessionsJobTemp.Execute()`: %+v", err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
			}

			job, err = n.client.Jobs().ParseHCL(jobDef.String(), false)
			if err != nil {
				return nil, &api.APIError{
					Msg:       fmt.Sprintf("Failed to parse the `%s` HCL job file: %+v", sessionsJobFile, err),
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
				Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: Timeout - %s", sessionsJobNameWithSlash, sessionID, allocationCheckTimeout.String()),
				ClientMsg: "Cannot create a session right now - timeout",
				Code:      http.StatusInternalServerError,
			}
			break allocationCheck
		default:
			allocs, _, err := n.client.Evaluations().Allocations(evalID, &nomadAPI.QueryOptions{})
			if err != nil {
				allocErr = &api.APIError{
					Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
					ClientMsg: "Cannot create a session right now",
					Code:      http.StatusInternalServerError,
				}
				break allocationCheck
			}

			for _, alloc := range allocs {
				if alloc.TaskStates[fcTaskName] == nil {
					continue
				}

				if alloc.TaskStates[fcTaskName].State == nomadTaskFailedState {
					msgStruct, _ := json.Marshal(newSession)
					allocErr = &api.APIError{
						Msg:       fmt.Sprintf("Cannot retrieve allocations for '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
						ClientMsg: fmt.Sprintf("Session couldn't be started: the problem may be in the request's payload - is the 'codeSnippetID' valid?: %+v", string(msgStruct)),
						Code:      http.StatusBadRequest,
					}
					break allocationCheck
				}
				fmt.Printf(alloc.TaskStates[fcTaskName].State)

				if alloc.TaskStates[fcTaskName].State == nomadTaskRunningState {
					session := &api.Session{
						ClientID:  alloc.NodeID[:shortNodeIDLength],
						SessionID: sessionID,
					}

					return session, nil
				}
				continue
			}
		}
		time.Sleep(allocationCheckInterval)
	}

	_, _, err = n.client.Jobs().Deregister(*job.ID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		fmt.Printf("Failed to deregister '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err)
	}

	return nil, allocErr
}

func (n *NomadClient) DeleteSession(sessionID string) *api.APIError {
	_, _, err := n.client.Jobs().Deregister(sessionsJobNameWithSlash+sessionID, false, &nomadAPI.WriteOptions{})
	if err != nil {
		return &api.APIError{
			Msg:       fmt.Sprintf("Cannot delete job '%s%s' job: %+v", sessionsJobNameWithSlash, sessionID, err),
			ClientMsg: "Cannot delete the session right now",
			Code:      http.StatusInternalServerError,
		}
	}
	return nil
}
