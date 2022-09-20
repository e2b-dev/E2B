// env package tries to load the Devbook environment variables.
package env

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"path"
	"strings"

	"github.com/devbookhq/devbookd/internal/log"
	"go.uber.org/zap"
)

type RuntimeMode string

const (
	envFilePath = "/.dbkenv"

	RuntimeModeServer RuntimeMode = "server"
	RuntimeModeUser   RuntimeMode = "user"

	ENV_VAR_RUN_CMD    = "RUN_CMD"
	ENV_VAR_RUN_ARGS   = "RUN_ARGS"
	ENV_VAR_WORKDIR    = "WORKDIR"
	ENV_VAR_ENTRYPOINT = "ENTRYPOINT"
)

type Env struct {
	runtimeMode RuntimeMode

	logDir string
	// shell is the path to a shell
	shell string

	// Env vars. Assigned only in the server mode.
	runCmd             string
	runArgs            string
	parsedRunArgs      []string
	workdir            string
	entrypoint         string
	entrypointFullPath string

	// Address of the default gateway interface inside Firecracker.
	defaultGatewayIP net.IP
}

func warnEmptyEnvVar(logger *zap.SugaredLogger, line, name string) {
	logger.Warnw(
		"The env var is empty",
		"line", line,
		"name", name,
	)
}

func configureEnvForUserMode(env *Env) error {
	// Create a new log dir or *delete the old one from previous session and create it again*.
	// We do this to "reset" log files.

	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("failed to determine location of the user's config directory: %s", err)
	}
	dbkConfigDir := path.Join(userConfigDir, "devbook")

	if _, err := os.Stat(dbkConfigDir); !os.IsNotExist(err) {
		// Config dir exists. Delete its content. This will remove old log files.
		if err := os.RemoveAll(dbkConfigDir); err != nil {
			return fmt.Errorf("failed to delete the old Devbook config directory at '%s': %s", dbkConfigDir, err)
		}
	}

	// (re)create the config dir.
	if err := os.MkdirAll(dbkConfigDir, os.ModePerm); err != nil {
		return fmt.Errorf("failed to create a Devbook config directory at '%s': %s", dbkConfigDir, err)
	}
	env.logDir = dbkConfigDir

	preferredShell, ok := os.LookupEnv("SHELL")
	if !ok {
		preferredShell = path.Join("/bin", "sh")
	}
	env.shell = preferredShell

	return nil
}

func configureEnvForServerMode(env *Env) {
	env.logDir = path.Join("/var", "log")
	env.shell = path.Join("/bin", "sh")
}

func NewEnv(rawRuntimeMode string) (*Env, *zap.SugaredLogger, error) {
	// Check that runtime mode is one of the allowed values.
	if rawRuntimeMode != string(RuntimeModeUser) && rawRuntimeMode != string(RuntimeModeServer) {
		return nil, nil, fmt.Errorf(
			"not allowed value for the 'env' flag. Allowed values are either 'server' or 'user'. Got '%s'",
			rawRuntimeMode,
		)
	}

	env := &Env{
		runtimeMode: RuntimeMode(rawRuntimeMode),
	}

	switch env.runtimeMode {
	case RuntimeModeUser:
		if err := configureEnvForUserMode(env); err != nil {
			return nil, nil, err
		}
	case RuntimeModeServer:
		configureEnvForServerMode(env)
	}

	logger, err := log.NewLogger(env.logDir)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create new logger: %s", err)
	}

	// Read and parse the /.dbkenv file only if we are in the server mode.
	// TODO: Move this configuration to `configureEnvForServerMode`?
	// We want to use a logger here though.
	if env.runtimeMode == RuntimeModeServer {
		logger.Infow("Loading envinronment", "envFilePath", envFilePath)

		file, err := os.Open(envFilePath)
		if err != nil {
			logger.Errorw("Failed to open env file",
				"envFilePath", envFilePath,
				"error", err,
			)
			return nil, nil, err
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			// Expects vars in the format "VAR_NAME=VALUE"
			// ["VAR_NAME", "VALUE"]
			line := scanner.Text()

			name, value, found := strings.Cut(line, "=")

			if !found {
				logger.Warnw("Invalid env format in the env file",
					"envFilePath", envFilePath,
					"line", line,
				)
			}

			logger.Infow("Loaded env var from the env file",
				"envFilePath", envFilePath,
				"name", name,
				"value", value,
			)

			if value == "" {
				warnEmptyEnvVar(logger, line, name)
				continue
			}

			switch name {
			case ENV_VAR_RUN_CMD:
				env.runCmd = value
			case ENV_VAR_RUN_ARGS:
				env.runArgs = value
				env.parsedRunArgs = strings.Fields(value)
			case ENV_VAR_WORKDIR:
				env.workdir = value
			case ENV_VAR_ENTRYPOINT:
				env.entrypoint = value
			default:
				logger.Warnw("Unknown env var in the env file. Will be ignored",
					"envFilePath", envFilePath,
					"line", line,
					"name", name,
					"value", value,
				)
			}
		}

		// Every Firecracker clone has the same default gateway IP.
		// TODO: This should also be specified in the /.dbkenv file.
		env.defaultGatewayIP = net.IPv4(169, 254, 0, 21)
		env.entrypointFullPath = path.Join(env.workdir, env.entrypoint)
	}

	return env, logger, nil
}

func (e *Env) Shell() string {
	return e.shell
}

func (e *Env) RuntimeMode() RuntimeMode {
	return e.runtimeMode
}

func (e *Env) RunCMD() string {
	return e.runCmd
}

func (e *Env) RawRunArgs() string {
	return e.runArgs
}

func (e *Env) ParsedRunArgs() []string {
	return e.parsedRunArgs
}

func (e *Env) Workdir() string {
	return e.workdir
}

func (e *Env) Entrypoint() string {
	return e.entrypoint
}

func (e *Env) EntrypointFullPath() string {
	return e.entrypointFullPath
}

func (e *Env) DefaultGatewayIP() net.IP {
	return e.defaultGatewayIP
}
