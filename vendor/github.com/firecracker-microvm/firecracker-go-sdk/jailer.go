// Copyright 2018-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may
// not use this file except in compliance with the License. A copy of the
// License is located at
//
//	http://aws.amazon.com/apache2.0/
//
// or in the "license" file accompanying this file. This file is distributed
// on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.

package firecracker

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

const (
	// defaultJailerPath is the default chroot base directory that the jailer
	// will use if no other base directory was provided.
	defaultJailerPath = "/srv/jailer/firecracker"
	defaultJailerBin  = "jailer"

	rootfsFolderName = "root"
)

var (
	// ErrMissingJailerConfig will occur when entering jailer logic but the
	// jailer config had not been specified.
	ErrMissingJailerConfig = fmt.Errorf("jailer config was not set for use")
)

// SeccompLevelValue represents a secure computing level type.
type SeccompLevelValue int

// secure computing levels
const (
	// SeccompLevelDisable is the default value.
	SeccompLevelDisable SeccompLevelValue = iota
	// SeccompLevelBasic prohibits syscalls not whitelisted by Firecracker.
	SeccompLevelBasic
	// SeccompLevelAdvanced adds further checks on some of the parameters of the
	// allowed syscalls.
	SeccompLevelAdvanced
)

// JailerConfig is jailer specific configuration needed to execute the jailer.
type JailerConfig struct {
	// GID the jailer switches to as it execs the target binary.
	GID *int

	// UID the jailer switches to as it execs the target binary.
	UID *int

	// ID is the unique VM identification string, which may contain alphanumeric
	// characters and hyphens. The maximum id length is currently 64 characters
	ID string

	// NumaNode represents the NUMA node the process gets assigned to.
	NumaNode *int

	// ExecFile is the path to the Firecracker binary that will be exec-ed by
	// the jailer. The user can provide a path to any binary, but the interaction
	// with the jailer is mostly Firecracker specific.
	ExecFile string

	// JailerBinary specifies the jailer binary to be used for setting up the
	// Firecracker VM jail. If the value contains no path separators, it will
	// use the PATH environment variable to get the absolute path of the binary.
	// If the value contains path separators, the value will be used directly
	// to exec the jailer. This follows the same conventions as Golang's
	// os/exec.Command.
	//
	// If not specified it defaults to "jailer".
	JailerBinary string

	// ChrootBaseDir represents the base folder where chroot jails are built. The
	// default is /srv/jailer
	ChrootBaseDir string

	// NetNS represents the path to a network namespace handle. If present, the
	// jailer will use this to join the associated network namespace
	NetNS string

	//  Daemonize is set to true, call setsid() and redirect STDIN, STDOUT, and
	//  STDERR to /dev/null
	Daemonize bool

	// SeccompLevel specifies whether seccomp filters should be installed and how
	// restrictive they should be. Possible values are:
	//
	//	0 : (default): disabled.
	//	1 : basic filtering. This prohibits syscalls not whitelisted by Firecracker.
	//	2 : advanced filtering. This adds further checks on some of the
	//			parameters of the allowed syscalls.
	SeccompLevel SeccompLevelValue

	// ChrootStrategy will dictate how files are transfered to the root drive.
	ChrootStrategy HandlersAdapter

	// Stdout specifies the IO writer for STDOUT to use when spawning the jailer.
	Stdout io.Writer
	// Stderr specifies the IO writer for STDERR to use when spawning the jailer.
	Stderr io.Writer
	// Stdin specifies the IO reader for STDIN to use when spawning the jailer.
	Stdin io.Reader
}

func (jailerCfg *JailerConfig) netNSPath() string {
	if jailerCfg == nil {
		return ""
	}
	return jailerCfg.NetNS
}

// JailerCommandBuilder will build a jailer command. This can be used to
// specify that a jailed firecracker executable wants to be run on the Machine.
type JailerCommandBuilder struct {
	bin      string
	id       string
	uid      int
	gid      int
	execFile string
	node     int

	// optional params
	chrootBaseDir string
	netNS         string
	daemonize     bool
	seccompLevel  SeccompLevelValue

	stdin  io.Reader
	stdout io.Writer
	stderr io.Writer
}

// NewJailerCommandBuilder will return a new jailer command builder with the
// proper default value initialized.
func NewJailerCommandBuilder() JailerCommandBuilder {
	return JailerCommandBuilder{}.WithBin(defaultJailerBin)
}

// Args returns the specified set of args to be used
// in command construction.
func (b JailerCommandBuilder) Args() []string {
	args := []string{}
	args = append(args, "--id", b.id)
	args = append(args, "--uid", strconv.Itoa(b.uid))
	args = append(args, "--gid", strconv.Itoa(b.gid))
	args = append(args, "--exec-file", b.execFile)
	args = append(args, "--node", strconv.Itoa(b.node))

	if len(b.chrootBaseDir) > 0 {
		args = append(args, "--chroot-base-dir", b.chrootBaseDir)
	}

	if len(b.netNS) > 0 {
		args = append(args, "--netns", b.netNS)
	}

	args = append(args, "--seccomp-level", strconv.Itoa(int(b.seccompLevel)))

	if b.daemonize {
		args = append(args, "--daemonize")
	}

	return args
}

// Bin returns the jailer bin path. If bin path is empty, then the default path
// will be returned.
func (b JailerCommandBuilder) Bin() string {
	return b.bin
}

// WithBin will set the specific bin path to the builder.
func (b JailerCommandBuilder) WithBin(bin string) JailerCommandBuilder {
	b.bin = bin
	return b
}

// WithID will set the specified id to the builder.
func (b JailerCommandBuilder) WithID(id string) JailerCommandBuilder {
	b.id = id
	return b
}

// WithUID will set the specified uid to the builder.
func (b JailerCommandBuilder) WithUID(uid int) JailerCommandBuilder {
	b.uid = uid
	return b
}

// WithGID will set the specified gid to the builder.
func (b JailerCommandBuilder) WithGID(gid int) JailerCommandBuilder {
	b.gid = gid
	return b
}

// WithExecFile will set the specified path to the builder. This represents a
// firecracker binary used when calling the jailer.
func (b JailerCommandBuilder) WithExecFile(path string) JailerCommandBuilder {
	b.execFile = path
	return b
}

// WithNumaNode uses the specfied node for the jailer. This represents the numa
// node that the process will get assigned to.
func (b JailerCommandBuilder) WithNumaNode(node int) JailerCommandBuilder {
	b.node = node
	return b
}

// WithChrootBaseDir will set the given path as the chroot base directory. This
// specifies where chroot jails are built and defaults to /srv/jailer.
func (b JailerCommandBuilder) WithChrootBaseDir(path string) JailerCommandBuilder {
	b.chrootBaseDir = path
	return b
}

// WithNetNS will set the given path to the net namespace of the builder. This
// represents the path to a network namespace handle and will be used to join
// the associated network namepsace.
func (b JailerCommandBuilder) WithNetNS(path string) JailerCommandBuilder {
	b.netNS = path
	return b
}

// WithDaemonize will specify whether to set stdio to /dev/null
func (b JailerCommandBuilder) WithDaemonize(daemonize bool) JailerCommandBuilder {
	b.daemonize = daemonize
	return b
}

// WithSeccompLevel will set the provided level to the builder. This represents
// the seccomp filters that should be installed and how restrictive they should
// be.
func (b JailerCommandBuilder) WithSeccompLevel(level SeccompLevelValue) JailerCommandBuilder {
	b.seccompLevel = level
	return b
}

// Stdout will return the stdout that will be used when creating the
// firecracker exec.Command
func (b JailerCommandBuilder) Stdout() io.Writer {
	return b.stdout
}

// WithStdout specifies which io.Writer to use in place of the os.Stdout in the
// firecracker exec.Command.
func (b JailerCommandBuilder) WithStdout(stdout io.Writer) JailerCommandBuilder {
	b.stdout = stdout
	return b
}

// Stderr will return the stderr that will be used when creating the
// firecracker exec.Command
func (b JailerCommandBuilder) Stderr() io.Writer {
	return b.stderr
}

// WithStderr specifies which io.Writer to use in place of the os.Stderr in the
// firecracker exec.Command.
func (b JailerCommandBuilder) WithStderr(stderr io.Writer) JailerCommandBuilder {
	b.stderr = stderr
	return b
}

// Stdin will return the stdin that will be used when creating the firecracker
// exec.Command
func (b JailerCommandBuilder) Stdin() io.Reader {
	return b.stdin
}

// WithStdin specifies which io.Reader to use in place of the os.Stdin in the
// firecracker exec.Command.
func (b JailerCommandBuilder) WithStdin(stdin io.Reader) JailerCommandBuilder {
	b.stdin = stdin
	return b
}

// Build will build a jailer command.
func (b JailerCommandBuilder) Build(ctx context.Context) *exec.Cmd {
	cmd := exec.CommandContext(
		ctx,
		b.Bin(),
		b.Args()...,
	)

	if stdin := b.Stdin(); stdin != nil {
		cmd.Stdin = stdin
	}

	if stdout := b.Stdout(); stdout != nil {
		cmd.Stdout = stdout
	}

	if stderr := b.Stderr(); stderr != nil {
		cmd.Stderr = stderr
	}

	return cmd
}

// Jail will set up proper handlers and remove configuration validation due to
// stating of files
func jail(ctx context.Context, m *Machine, cfg *Config) error {
	jailerWorkspaceDir := ""
	if len(cfg.JailerCfg.ChrootBaseDir) > 0 {
		jailerWorkspaceDir = filepath.Join(cfg.JailerCfg.ChrootBaseDir, "firecracker", cfg.JailerCfg.ID, rootfsFolderName)
	} else {
		jailerWorkspaceDir = filepath.Join(defaultJailerPath, cfg.JailerCfg.ID, rootfsFolderName)
	}

	cfg.SocketPath = filepath.Join(jailerWorkspaceDir, "api.socket")

	stdout := cfg.JailerCfg.Stdout
	if stdout == nil {
		stdout = os.Stdout
	}

	stderr := cfg.JailerCfg.Stderr
	if stderr == nil {
		stderr = os.Stderr
	}

	builder := NewJailerCommandBuilder().
		WithID(cfg.JailerCfg.ID).
		WithUID(*cfg.JailerCfg.UID).
		WithGID(*cfg.JailerCfg.GID).
		WithNumaNode(*cfg.JailerCfg.NumaNode).
		WithExecFile(cfg.JailerCfg.ExecFile).
		WithChrootBaseDir(cfg.JailerCfg.ChrootBaseDir).
		WithDaemonize(cfg.JailerCfg.Daemonize).
		WithSeccompLevel(cfg.JailerCfg.SeccompLevel).
		WithStdout(stdout).
		WithStderr(stderr)

	if jailerBinary := cfg.JailerCfg.JailerBinary; jailerBinary != "" {
		builder = builder.WithBin(jailerBinary)
	}

	if netNS := cfg.JailerCfg.NetNS; netNS != "" {
		builder = builder.WithNetNS(netNS)
	}

	if stdin := cfg.JailerCfg.Stdin; stdin != nil {
		builder = builder.WithStdin(stdin)
	}

	m.cmd = builder.Build(ctx)

	if err := cfg.JailerCfg.ChrootStrategy.AdaptHandlers(&m.Handlers); err != nil {
		return err
	}

	return nil
}

func linkFileToRootFS(cfg *JailerConfig, dst, src string) error {
	if err := os.Link(src, dst); err != nil {
		return err
	}

	return nil
}

// LinkFilesHandler creates a new link files handler that will link files to
// the rootfs
func LinkFilesHandler(rootfs, kernelImageFileName string) Handler {
	return Handler{
		Name: LinkFilesToRootFSHandlerName,
		Fn: func(ctx context.Context, m *Machine) error {
			if m.Cfg.JailerCfg == nil {
				return ErrMissingJailerConfig
			}

			// copy kernel image to root fs
			if err := linkFileToRootFS(
				m.Cfg.JailerCfg,
				filepath.Join(rootfs, kernelImageFileName),
				m.Cfg.KernelImagePath,
			); err != nil {
				return err
			}

			// copy all drives to the root fs
			for i, drive := range m.Cfg.Drives {
				hostPath := StringValue(drive.PathOnHost)
				driveFileName := filepath.Base(hostPath)

				if err := linkFileToRootFS(
					m.Cfg.JailerCfg,
					filepath.Join(rootfs, driveFileName),
					hostPath,
				); err != nil {
					return err
				}

				m.Cfg.Drives[i].PathOnHost = String(driveFileName)
			}

			m.Cfg.KernelImagePath = kernelImageFileName

			for _, fifoPath := range []*string{&m.Cfg.LogFifo, &m.Cfg.MetricsFifo} {
				if fifoPath == nil || *fifoPath == "" {
					continue
				}

				fileName := filepath.Base(*fifoPath)
				if err := linkFileToRootFS(
					m.Cfg.JailerCfg,
					filepath.Join(rootfs, fileName),
					*fifoPath,
				); err != nil {
					return err
				}

				if err := os.Chown(filepath.Join(rootfs, fileName), *m.Cfg.JailerCfg.UID, *m.Cfg.JailerCfg.GID); err != nil {
					return err
				}

				// update fifoPath as jailer works relative to the chroot dir
				*fifoPath = fileName
			}

			return nil
		},
	}
}

// NaiveChrootStrategy will simply hard link all files, drives and kernel
// image, to the root drive.
type NaiveChrootStrategy struct {
	Rootfs          string
	KernelImagePath string
}

// NewNaiveChrootStrategy returns a new NaivceChrootStrategy
func NewNaiveChrootStrategy(rootfs, kernelImagePath string) NaiveChrootStrategy {
	return NaiveChrootStrategy{
		Rootfs:          rootfs,
		KernelImagePath: kernelImagePath,
	}
}

// ErrRequiredHandlerMissing occurs when a required handler is not present in
// the handler list.
var ErrRequiredHandlerMissing = fmt.Errorf("required handler is missing from FcInit's list")

// AdaptHandlers will inject the LinkFilesHandler into the handler list.
func (s NaiveChrootStrategy) AdaptHandlers(handlers *Handlers) error {
	if !handlers.FcInit.Has(CreateLogFilesHandlerName) {
		return ErrRequiredHandlerMissing
	}

	handlers.FcInit = handlers.FcInit.AppendAfter(
		CreateLogFilesHandlerName,
		LinkFilesHandler(filepath.Join(s.Rootfs, rootfsFolderName), filepath.Base(s.KernelImagePath)),
	)

	return nil
}
