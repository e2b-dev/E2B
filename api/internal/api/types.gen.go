// Package api provides primitives to interact with the openapi HTTP API.
//
// Code generated by github.com/deepmap/oapi-codegen version v1.10.1 DO NOT EDIT.
package api

// Defines values for EnvironmentState.
const (
	EnvironmentStateBuilding EnvironmentState = "Building"

	EnvironmentStateDone EnvironmentState = "Done"

	EnvironmentStateFailed EnvironmentState = "Failed"
)

// Defines values for EnvironmentStateUpdateState.
const (
	EnvironmentStateUpdateStateBuilding EnvironmentStateUpdateState = "Building"

	EnvironmentStateUpdateStateDone EnvironmentStateUpdateState = "Done"

	EnvironmentStateUpdateStateFailed EnvironmentStateUpdateState = "Failed"
)

// Defines values for NewEnvironmentTemplate.
const (
	NewEnvironmentTemplateNodejs NewEnvironmentTemplate = "Nodejs"
)

// DeleteEnvironment defines model for DeleteEnvironment.
type DeleteEnvironment struct {
	CodeSnippetID string `json:"codeSnippetID"`
}

// Environment defines model for Environment.
type Environment struct {
	// Embedded struct due to allOf(#/components/schemas/NewEnvironment)
	NewEnvironment `yaml:",inline"`
	// Embedded fields due to inline allOf schema
	Id    string           `json:"id"`
	State EnvironmentState `json:"state"`
}

// EnvironmentState defines model for Environment.State.
type EnvironmentState string

// EnvironmentStateUpdate defines model for EnvironmentStateUpdate.
type EnvironmentStateUpdate struct {
	CodeSnippetID string                      `json:"codeSnippetID"`
	State         EnvironmentStateUpdateState `json:"state"`
}

// EnvironmentStateUpdateState defines model for EnvironmentStateUpdate.State.
type EnvironmentStateUpdateState string

// Error defines model for Error.
type Error struct {
	// Error code
	Code int32 `json:"code"`

	// Error
	Message string `json:"message"`
}

// NewEnvironment defines model for NewEnvironment.
type NewEnvironment struct {
	CodeSnippetID string                 `json:"codeSnippetID"`
	Deps          []string               `json:"deps"`
	Template      NewEnvironmentTemplate `json:"template"`
}

// NewEnvironmentTemplate defines model for NewEnvironment.Template.
type NewEnvironmentTemplate string

// NewSession defines model for NewSession.
type NewSession struct {
	// Identifier of a code snippet which which is the environment associated
	CodeSnippetID string `json:"codeSnippetID"`
}

// Session defines model for Session.
type Session struct {
	// Identifier of the client
	ClientID string `json:"clientID"`

	// Identifier of the session
	SessionID string `json:"sessionID"`
}

// DeleteEnvsJSONBody defines parameters for DeleteEnvs.
type DeleteEnvsJSONBody DeleteEnvironment

// PostEnvsStateJSONBody defines parameters for PostEnvsState.
type PostEnvsStateJSONBody EnvironmentStateUpdate

// PostSessionsJSONBody defines parameters for PostSessions.
type PostSessionsJSONBody NewSession

// DeleteEnvsJSONRequestBody defines body for DeleteEnvs for application/json ContentType.
type DeleteEnvsJSONRequestBody DeleteEnvsJSONBody

// PostEnvsStateJSONRequestBody defines body for PostEnvsState for application/json ContentType.
type PostEnvsStateJSONRequestBody PostEnvsStateJSONBody

// PostSessionsJSONRequestBody defines body for PostSessions for application/json ContentType.
type PostSessionsJSONRequestBody PostSessionsJSONBody
