package nomad

import "strings"

const (
	templatesDir = "go-templates"
	fcEnvsDisk   = "/mnt/disks/fc-envs"
)

var (
  escapeReplacer = strings.NewReplacer(
    // HCL doesn't allow newlines in strings. We have to escape them.
    "\n", "\\\\n",
    // " -> \"
    `"`, `\"`,
  )
)

// Escapes various characters that need to be escaped in the HCL files.
func escapeHCL(input string) string {
  return escapeReplacer.Replace(input)
	//return strings.Replace(input, "\n", "\\\\n", -1)
}
