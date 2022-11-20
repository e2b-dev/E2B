package api

type APIError struct {
	Msg       string
	ClientMsg string
	Code      int
}

func (err *APIError) Error() string {
	return err.Msg
}
