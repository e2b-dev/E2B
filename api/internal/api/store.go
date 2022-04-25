package api

import (
	"net/http"
	"sync"

	"api/pkg/nomad"

	"github.com/gin-gonic/gin"
)

type APIStore struct {
	nomad  *nomad.Nomad
	NextId int64
	Lock   sync.Mutex
}

func NewAPIStore(nomad *nomad.Nomad) *APIStore {
	return &APIStore{
		nomad:  nomad,
		NextId: 1000,
	}
}

// This function wraps sending of an error in the Error format, and
// handling the failure to marshal that.
func sendAPIStoreError(c *gin.Context, code int, message string) {
	apiErr := Error{
		Code:    int32(code),
		Message: message,
	}

	c.JSON(code, apiErr)
}

func (p *APIStore) PostSession(c *gin.Context) {
	// We're always asynchronous, so lock unsafe operations below
	p.Lock.Lock()
	defer p.Lock.Unlock()

	session, _, err := p.nomad.CreateSession(nomad.SessionJobID)

	if err != nil {
		sendAPIStoreError(c, http.StatusNotFound, "Error creating session")
		return
	}

	c.JSON(http.StatusCreated, Session{SessionId: session.DispatchedJobID})
}

func (p *APIStore) DeleteSessionSessionId(c *gin.Context, id string) {
	p.Lock.Lock()
	defer p.Lock.Unlock()

	_, _, err := p.nomad.DeleteSession(nomad.SessionJobID)

	if err != nil {
		sendAPIStoreError(c, http.StatusNotFound, "Error deleting session")
		return
	}

	c.JSON(http.StatusNoContent, Session{SessionId: id})
}
