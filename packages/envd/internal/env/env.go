package env

import (
	"fmt"
	"net"
	"os"
	"path/filepath"

	"github.com/e2b-dev/infra/packages/envd/internal/log"
	"go.uber.org/zap"
)

var (
	defaultLogDir    = filepath.Join("/var", "log")
	defaultGatewayIP = net.IPv4(169, 254, 0, 21)
	defaultWorkdir   = "/code"
)

type EnvConfig struct {
	LogDir string

	Workdir string
	// shell is the path to a shell
	Shell string

	// Address of the default gateway interface inside Firecracker.
	GatewayIP net.IP

	Debug bool
}

func NewEnv(debug bool) (*EnvConfig, *zap.SugaredLogger, error) {
	preferredShell, ok := os.LookupEnv("SHELL")
	if !ok {
		preferredShell = filepath.Join("/bin", "bash")
	}

	l, err := log.NewLogger(defaultLogDir, debug, true)
	if err != nil {
		return nil, nil, fmt.Errorf("error creating a new logger: %w", err)
	}

	return &EnvConfig{
		Debug:     debug,
		Workdir:   defaultWorkdir,
		LogDir:    defaultLogDir,
		Shell:     preferredShell,
		GatewayIP: defaultGatewayIP,
	}, l, nil
}
