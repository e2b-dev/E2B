package nomad

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"path"
	"text/template"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/api"
	nomadAPI "github.com/hashicorp/nomad/api"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const (
	sessionsJobName          = "fc-sessions"
	sessionsJobNameWithSlash = sessionsJobName + "/"
	sessionsJobFile          = sessionsJobName + jobFileSuffix
	jobRegisterTimeout       = time.Second * 10
	allocationCheckTimeout   = time.Second * 20
	fcTaskName               = "start"
	sessionIDPrefix          = "s"
	sessionIDRandomLength    = 7
	shortNodeIDLength        = 8
	nomadTaskRunningState    = "running"
	nomadTaskDeadState       = "dead"
)

var (
	logsProxyAddress = os.Getenv("LOGS_PROXY_ADDRESS")
	consulToken      = os.Getenv("CONSUL_TOKEN")
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

func (n *NomadClient) CreateSession(t trace.Tracer, ctx context.Context, newSession *api.NewSession) (*api.Session, *api.APIError) {
	_, childSpan := t.Start(ctx, "create-session",
		trace.WithAttributes(
			attribute.String("code_snippet_id", newSession.CodeSnippetID),
		),
	)
	defer childSpan.End()

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
	sessionID := sessionIDPrefix + genRandomSession(sessionIDRandomLength)
	// var evalID string
	var job *nomadAPI.Job

	traceID := childSpan.SpanContext().TraceID().String()
	spanID := childSpan.SpanContext().SpanID().String()

	childSpan.SetAttributes(
		attribute.String("passed_trace_id_hex", string(traceID)),
		attribute.String("passed_span_id_hex", string(spanID)),
	)

jobRegister:
	for {
		select {
		case <-time.After(jobRegisterTimeout):
			return nil, &api.APIError{
				Msg:       "failed to find empty sessionID",
				ClientMsg: "Cannot create a session right now",
				Code:      http.StatusInternalServerError,
			}
		default:
			var jobDef bytes.Buffer
			jobVars := struct {
				SpanID           string
				ConsulToken      string
				TraceID          string
				CodeSnippetID    string
				SessionID        string
				LogsProxyAddress string
				FCTaskName       string
				JobName          string
				FCEnvsDisk       string
				EditEnabled      bool
			}{
				SpanID:           spanID,
				TraceID:          traceID,
				LogsProxyAddress: logsProxyAddress,
				ConsulToken:      consulToken,
				CodeSnippetID:    newSession.CodeSnippetID,
				SessionID:        sessionID,
				FCTaskName:       fcTaskName,
				JobName:          sessionsJobName,
				FCEnvsDisk:       fcEnvsDisk,
				EditEnabled:      *newSession.EditEnabled,
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

			_, _, err := n.client.Jobs().Register(job, &nomadAPI.WriteOptions{})
			if err != nil {
				fmt.Printf("Failed to register '%s%s' job: %+v", sessionsJobNameWithSlash, jobVars.SessionID, err)
				continue
			}

			// evalID = res.EvalID
			break jobRegister
		}
	}

	// alloc, err := n.WaitForJob(
	// 	JobInfo{
	// 		name:   sessionsJobNameWithSlash + sessionID,
	// 		evalID: evalID,
	// 		index:  0,
	// 	},
	// 	allocationCheckTimeout,
	// )
	if err != nil {
		apiErr := n.DeleteSession(sessionID, false)
		if apiErr != nil {
			fmt.Printf("error in cleanup after failing to create session for code snippet '%s':%+v", newSession.CodeSnippetID, apiErr.Msg)
		}

		return nil, &api.APIError{
			Msg:       err.Error(),
			ClientMsg: "Cannot create a session right now",
			Code:      http.StatusInternalServerError,
		}
	}

	childSpan.SetAttributes(
		attribute.String("session_id", sessionID),
	)

	session := &api.Session{
		ClientID: "2c8c4ddb",
		// ClientID:      alloc.NodeID[:shortNodeIDLength],
		SessionID:     sessionID,
		CodeSnippetID: newSession.CodeSnippetID,
		EditEnabled:   *newSession.EditEnabled,
	}

	return session, nil
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
