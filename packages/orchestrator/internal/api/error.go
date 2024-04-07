package api

type APIError struct {
	Err       error
	ClientMsg string
	Code      int
}
