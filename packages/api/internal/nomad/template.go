package nomad

import "strings"

var escapeReplacer = strings.NewReplacer(
	// HCL doesn't allow newlines in strings. We have to escape them.
	"\n", "\\\\n",
	// " -> \"
	`"`, `\"`,
)

// Escapes various characters that need to be escaped in the HCL files.
func escapeHCL(input string) string {
	return escapeReplacer.Replace(input)
}
