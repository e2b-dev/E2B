package env

import (
	"os"
	"path/filepath"
)

const (
	buildIDName  = "build_id"
	rootfsName   = "rootfs.ext4"
	snapfileName = "snapfile"
	memfileName  = "memfile"

	buildDirName = "builds"
	mntDirName   = "mnt"
)

type EnvSetup struct {
	// Unique ID of the env.
	EnvID string
	// Unique ID of the build - this is used to distinguish builds of the same env that can start simultaneously.
	BuildID string

	// Path to the directory where all envs are stored.
	EnvsPath string

	// Path to the directory where all docker contexts are stored. This directory is a FUSE mounted bucket where the contexts were uploaded.
	DockerContextsPath string

	// Docker registry where the docker images are uploaded for archivation/caching.
	DockerRegistry string

	// Path to where the kernel image is stored.
	KernelImagePath string

	// The number of vCPUs to allocate to the VM.
	VCpuCount int64

	// The amount of memory to allocate to the VM, in MiB.
	MemoryMB int64
}

// Represent the env stored on the filesystem.
// Is also used for moving the env to the final directory where it will be stored.
type Env struct {
	EnvSetup

	// Path to the directory where the build files are mounted.
	TmpBuildMountDirPath string

	// Path to the docker context.
	DockerContextPath string
	// Docker tag of the docker image for this env.
	DockerTag string

	// Path to the directory where the temporary files for the build are stored.
	TmpBuildDirPath string

	// Path to the file where the build ID is stored. This is used for setting up the namespaces when starting the FC snapshot for this build/env.
	tmpBuildIDFilePath string
	tmpRootfsPath      string
	tmpMemfilePath     string
	tmpSnapfilePath    string

	// Path to the directory where the env is stored.
	EnvDirPath string

	envBuildIDFilePath string
	envRootfsPath      string
	envMemfilePath     string
	envSnapfilePath    string
}

func NewEnv(setup EnvSetup) (*Env, error) {
	envDirPath := filepath.Join(setup.EnvsPath, setup.EnvID)
	tmpBuildDirPath := filepath.Join(envDirPath, buildDirName, setup.BuildID)

	env := &Env{
		EnvSetup: setup,

		TmpBuildMountDirPath: filepath.Join(tmpBuildDirPath, mntDirName),

		DockerContextPath: filepath.Join(setup.DockerContextsPath, setup.EnvID),
		DockerTag:         setup.DockerRegistry + "/" + setup.EnvID,

		TmpBuildDirPath: tmpBuildDirPath,

		tmpBuildIDFilePath: filepath.Join(tmpBuildDirPath, buildIDName),
		tmpRootfsPath:      filepath.Join(tmpBuildDirPath, rootfsName),
		tmpMemfilePath:     filepath.Join(tmpBuildDirPath, memfileName),
		tmpSnapfilePath:    filepath.Join(tmpBuildDirPath, snapfileName),

		EnvDirPath: envDirPath,

		envBuildIDFilePath: filepath.Join(envDirPath, buildIDName),
		envRootfsPath:      filepath.Join(envDirPath, rootfsName),
		envMemfilePath:     filepath.Join(envDirPath, memfileName),
		envSnapfilePath:    filepath.Join(envDirPath, snapfileName),
	}

	err := env.initializeFS()
	return env, err
}

func (e *Env) initializeFS() error {
	// We don't need to create build dir because by creating the build mountdir we create the build dir.
	err := os.MkdirAll(e.TmpBuildMountDirPath, 0777)
	if err != nil {
		return err
	}

	err = os.WriteFile(e.tmpBuildIDFilePath, []byte(e.BuildID), 0777)
	if err != nil {
		return err
	}

	return nil
}

func (e *Env) MoveToEnvDir() error {
	err := os.Rename(e.tmpSnapfilePath, e.envSnapfilePath)
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpMemfilePath, e.envMemfilePath)
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpRootfsPath, e.envRootfsPath)
	if err != nil {
		return nil
	}
	err = os.Rename(e.tmpBuildIDFilePath, e.envBuildIDFilePath)
	if err != nil {
		return nil
	}

	return nil
}

func (e *Env) Cleanup() error {
	return os.RemoveAll(e.TmpBuildDirPath)
}
