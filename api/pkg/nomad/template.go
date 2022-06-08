package nomad

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
)

const (
	templatesDir     = "go-templates"
	envTemplatesDir  = "env-templates"
	fcEnvsDisk       = "/mnt/disks/fc-envs"
	dockerfileSuffix = ".Dockerfile"
	jobFileSuffix    = ".hcl"
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

func GetTemplates() (*[]string, error) {
	tempDirPath := filepath.Join(templatesDir, envTemplatesDir)

	files, err := ioutil.ReadDir(tempDirPath)
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

func (n *NomadClient) RebuildTemplates() error {
	templates, err := GetTemplates()
	if err != nil {
		return fmt.Errorf("error retrieving templates from the filesystem: %+v", err)
	}

	for _, template := range *templates {
		err := n.BuildEnv(template, template, []string{})

		if err != nil {
			return err
		}
	}

	return nil
}
