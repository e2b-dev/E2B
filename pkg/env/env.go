// env package tries to load the Devbook environment variables.
package env

import (
	"bufio"
	"net"
	"os"
	"path"
	"strings"

	"go.uber.org/zap"
)

const (
	envFilePath = "/.dbkenv"

	ENV_VAR_RUN_CMD    = "RUN_CMD"
	ENV_VAR_RUN_ARGS   = "RUN_ARGS"
	ENV_VAR_WORKDIR    = "WORKDIR"
	ENV_VAR_ENTRYPOINT = "ENTRYPOINT"
)

type Env struct {
	logger *zap.SugaredLogger

	// Env vars
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

func NewEnv(logger *zap.SugaredLogger) (*Env, error) {
	logger.Infow("Loading envinronment", "envFilePath", envFilePath)

	file, err := os.Open(envFilePath)
	if err != nil {
		logger.Errorw("Failed to open env file",
			"envFilePath", envFilePath,
			"error", err,
		)
		return nil, err
	}
	defer file.Close()

	env := &Env{}
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
			logger.Warnw("Unknown env var in the env file",
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
	return env, nil
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
