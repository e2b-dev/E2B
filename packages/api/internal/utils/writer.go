package utils

// NoOpWriter is an io.Writer implementation that discards anything written to it.
type NoOpWriter struct{}

func (nw *NoOpWriter) Write(p []byte) (n int, err error) {
	return len(p), nil // Return the length of the input, but don't do anything with it.
}
