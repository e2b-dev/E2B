package nomad

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/devbookhq/devbook-api/packages/api/internal/utils"
	"go.opentelemetry.io/otel/trace"
)

const (
	templatesDir     = "go-templates"
	envTemplatesDir  = "env-templates"
	fcEnvsDisk       = "/mnt/disks/fc-envs"
	dockerfileSuffix = ".Dockerfile"
	jobFileSuffix    = ".hcl"

	templateTaskName     = "build-env"
	buildTemplateTimeout = time.Minute * 5
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
}

func GetTemplates() (*[]string, error) {
	tempDirPath := filepath.Join(templatesDir, envTemplatesDir)

	files, err := os.ReadDir(tempDirPath)
	if err != nil {
		return nil, fmt.Errorf("error reading dir %s: %+v", tempDirPath, err)
	}

	templates := []string{}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if !strings.HasSuffix(file.Name(), dockerfileSuffix) {
			continue
		}

		name := strings.TrimSuffix(file.Name(), dockerfileSuffix)

		templates = append(templates, name)
	}

	return &templates, nil
}

func (n *NomadClient) RebuildTemplates(t trace.Tracer) error {
	templates, err := GetTemplates()
	if err != nil {
		return fmt.Errorf("error retrieving templates from the filesystem: %+v", err)
	}

	templateParallelBuildLock := utils.CreateRequestLimitLock(2)

	for _, template := range *templates {
		go func(template string) {
			unlock := templateParallelBuildLock()
			defer unlock()

			fmt.Printf("Rebuilding %s\n", template)
			job, err := n.BuildEnv(template, template)
			if err != nil {
				fmt.Printf("error starting template '%s' building: %+v\n", template, err)
				return
			}
			fmt.Printf("Rebuilding template '%s' started\n", template)
			err = n.WaitForEnvBuild(*job, buildTemplateTimeout)
			if err != nil {
				fmt.Printf("error waiting for template '%s' to build: %+v\n", template, err)
				return
			}

			fmt.Printf("built template environment '%s'\n", template)
		}(template)
	}

	return nil
}
