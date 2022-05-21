package nomad

import "strings"

const (
	templatesDir = "templates"
)

func escapeNewLines(input string) string {
	// HCL doesn't allow newlines in strings. We have to escape them.
	return strings.Replace(input, "\n", "\\\\n", -1)
}
