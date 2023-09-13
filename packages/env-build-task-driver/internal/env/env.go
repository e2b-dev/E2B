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
	EnvID   string
	BuildID string

	EnvsPath string

	DockerContextsPath string
	DockerRegistry     string

	KernelImagePath string

	VCpuCount int64
	MemoryMB  int64
}

// Represent the env stored on the host.
// Can be passed to specify location of the env where we want to build artifacts.
// Is also used for moving the env.
type Env struct {
	EnvSetup

	DirPath string

	BuildDirPath      string
	BuildMountDirPath string

	DockerContextPath string
	DockerTag         string

	buildIDFilePath string
}

func NewEnv(setup EnvSetup) (*Env, error) {
	envDirPath := filepath.Join(setup.EnvsPath, setup.EnvID)
	buildDirPath := filepath.Join(envDirPath, buildDirName, setup.BuildID)

	env := &Env{
		EnvSetup: setup,

		DirPath: envDirPath,

		BuildDirPath:      buildDirPath,
		BuildMountDirPath: filepath.Join(buildDirPath, mntDirName),

		DockerContextPath: filepath.Join(setup.DockerContextsPath, setup.EnvID),
		DockerTag:         setup.DockerRegistry + "/" + setup.EnvID,

		buildIDFilePath: filepath.Join(buildDirPath, buildIDName),
	}

	// We don't need to create build dir because by creating the build mountdir we create the build dir.
	err := os.MkdirAll(env.BuildMountDirPath, 0777)
	if err != nil {
		return nil, err
	}

	err = os.WriteFile(env.buildIDFilePath, []byte(env.BuildID), 0777)
	if err != nil {
		return nil, err
	}

	return env, nil
}

func (e *Env) MoveToFinalEnvDir() error {
	os.Rename()
}

func (e *Env) Cleanup() error {
	return os.RemoveAll(e.BuildDirPath)
}

// BUILD_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID/builds/$RUN_UUID"
// BUILD_MNT_DIR="$BUILD_DIR/mnt"

// BUILD_FC_ROOTFS="$BUILD_DIR/rootfs.ext4"
// BUILD_FC_SNAPFILE="$BUILD_DIR/snapfile"
// BUILD_FC_MEMFILE="$BUILD_DIR/memfile"
// BUILD_BUILD_ID_FILE="$BUILD_DIR/build_id"

// FINAL_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID"
// FINAL_FC_ROOTFS="$FINAL_DIR/rootfs.ext4"
// FINAL_FC_SNAPFILE="$FINAL_DIR/snapfile"
// FINAL_FC_MEMFILE="$FINAL_DIR/memfile"
// FINAL_BUILD_ID_FILE="$FINAL_DIR/build_id"

// function mkdirs() {
//   mkdir -p $BUILD_DIR
//   mkdir -p $BUILD_MNT_DIR
//   # `$FINAL_DIR` is now already created because we created the `$BUILD_DIR` or from the previous runs.
// }

// function mkbuildidfile() {
//   echo -n "${RUN_UUID}" >${BUILD_BUILD_ID_FILE}
// }

// function mv_env_files() {
//   mv $BUILD_FC_ROOTFS $FINAL_FC_ROOTFS
//   mv $BUILD_FC_SNAPFILE $FINAL_FC_SNAPFILE
//   mv $BUILD_FC_MEMFILE $FINAL_FC_MEMFILE
//   mv $BUILD_BUILD_ID_FILE $FINAL_BUILD_ID_FILE
// }

// function del_build_dir() {
//   rm -rf $BUILD_DIR
// }
