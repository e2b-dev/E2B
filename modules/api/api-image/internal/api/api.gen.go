// Package api provides primitives to interact with the openapi HTTP API.
//
// Code generated by github.com/deepmap/oapi-codegen version v1.10.1 DO NOT EDIT.
package api

import (
	"fmt"
	"net/http"

	"github.com/deepmap/oapi-codegen/pkg/runtime"
	"github.com/gin-gonic/gin"
)

// ServerInterface represents all server handlers.
type ServerInterface interface {

	// (GET /)
	Get(c *gin.Context)

	// (POST /env)
	PostEnv(c *gin.Context)

	// (GET /sessions)
	GetSessions(c *gin.Context)

	// (POST /sessions)
	PostSessions(c *gin.Context)

	// (DELETE /sessions/{session_id})
	DeleteSessionsSessionId(c *gin.Context, sessionId string)
}

// ServerInterfaceWrapper converts contexts to parameters.
type ServerInterfaceWrapper struct {
	Handler            ServerInterface
	HandlerMiddlewares []MiddlewareFunc
}

type MiddlewareFunc func(c *gin.Context)

// Get operation middleware
func (siw *ServerInterfaceWrapper) Get(c *gin.Context) {

	for _, middleware := range siw.HandlerMiddlewares {
		middleware(c)
	}

	siw.Handler.Get(c)
}

// PostEnv operation middleware
func (siw *ServerInterfaceWrapper) PostEnv(c *gin.Context) {

	for _, middleware := range siw.HandlerMiddlewares {
		middleware(c)
	}

	siw.Handler.PostEnv(c)
}

// GetSessions operation middleware
func (siw *ServerInterfaceWrapper) GetSessions(c *gin.Context) {

	for _, middleware := range siw.HandlerMiddlewares {
		middleware(c)
	}

	siw.Handler.GetSessions(c)
}

// PostSessions operation middleware
func (siw *ServerInterfaceWrapper) PostSessions(c *gin.Context) {

	for _, middleware := range siw.HandlerMiddlewares {
		middleware(c)
	}

	siw.Handler.PostSessions(c)
}

// DeleteSessionsSessionId operation middleware
func (siw *ServerInterfaceWrapper) DeleteSessionsSessionId(c *gin.Context) {

	var err error

	// ------------- Path parameter "session_id" -------------
	var sessionId string

	err = runtime.BindStyledParameter("simple", false, "session_id", c.Param("session_id"), &sessionId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"msg": fmt.Sprintf("Invalid format for parameter session_id: %s", err)})
		return
	}

	for _, middleware := range siw.HandlerMiddlewares {
		middleware(c)
	}

	siw.Handler.DeleteSessionsSessionId(c, sessionId)
}

// GinServerOptions provides options for the Gin server.
type GinServerOptions struct {
	BaseURL     string
	Middlewares []MiddlewareFunc
}

// RegisterHandlers creates http.Handler with routing matching OpenAPI spec.
func RegisterHandlers(router *gin.Engine, si ServerInterface) *gin.Engine {
	return RegisterHandlersWithOptions(router, si, GinServerOptions{})
}

// RegisterHandlersWithOptions creates http.Handler with additional options
func RegisterHandlersWithOptions(router *gin.Engine, si ServerInterface, options GinServerOptions) *gin.Engine {
	wrapper := ServerInterfaceWrapper{
		Handler:            si,
		HandlerMiddlewares: options.Middlewares,
	}

	router.GET(options.BaseURL+"/", wrapper.Get)

	router.POST(options.BaseURL+"/env", wrapper.PostEnv)

	router.GET(options.BaseURL+"/sessions", wrapper.GetSessions)

	router.POST(options.BaseURL+"/sessions", wrapper.PostSessions)

	router.DELETE(options.BaseURL+"/sessions/:session_id", wrapper.DeleteSessionsSessionId)

	return router
}
