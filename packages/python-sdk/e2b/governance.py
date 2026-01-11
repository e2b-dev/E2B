"""
Optional SwiftAPI governance integration for E2B sandboxes.

This module provides cryptographic attestation for sandbox command execution,
enabling fail-closed governance where AI agents can only execute approved actions.

Requires: pip install swiftapi-python

Usage:
    from e2b import Sandbox
    from e2b.governance import GovernedSandbox

    sandbox = Sandbox.create()
    governed = GovernedSandbox(sandbox, swiftapi_key="swiftapi_live_...")

    # Commands require attestation before execution
    result = governed.commands.run("echo hello", intent="Print greeting")
"""

from typing import Callable, Dict, List, Optional, Union

try:
    from swiftapi import Enforcement, SwiftAPI

    SWIFTAPI_AVAILABLE = True
except ImportError:
    SWIFTAPI_AVAILABLE = False
    SwiftAPI = None
    Enforcement = None

from e2b.exceptions import SandboxException
from e2b.sandbox.commands.command_handle import CommandResult
from e2b.sandbox.commands.main import ProcessInfo


class GovernanceError(SandboxException):
    """Raised when governance verification fails."""

    pass


class GovernedCommands:
    """
    Wrapper around sandbox commands with SwiftAPI governance.

    All command execution requires cryptographic attestation.
    """

    def __init__(
        self,
        commands,
        enforcement: "Enforcement",
        actor: str = "e2b-agent",
    ):
        self._commands = commands
        self._enforcement = enforcement
        self._actor = actor

    def list(self, request_timeout: Optional[float] = None) -> List[ProcessInfo]:
        """List running commands. No attestation required for read operations."""
        return self._commands.list(request_timeout=request_timeout)

    def kill(self, pid: int, request_timeout: Optional[float] = None) -> bool:
        """
        Kill a running command with governance attestation.

        :param pid: Process ID to kill
        :param request_timeout: Timeout for the request
        :return: True if killed, False if not found
        """
        return self._enforcement.run(
            lambda: self._commands.kill(pid, request_timeout=request_timeout),
            action="process_kill",
            intent=f"Kill process {pid}",
            params={"pid": pid},
            actor=self._actor,
        )

    def send_stdin(
        self,
        pid: int,
        data: str,
        request_timeout: Optional[float] = None,
    ):
        """
        Send data to command stdin with governance attestation.

        :param pid: Process ID
        :param data: Data to send
        :param request_timeout: Timeout for the request
        """
        self._enforcement.run(
            lambda: self._commands.send_stdin(
                pid, data, request_timeout=request_timeout
            ),
            action="process_stdin",
            intent=f"Send stdin to process {pid}",
            params={"pid": pid, "data_length": len(data)},
            actor=self._actor,
        )

    def run(
        self,
        cmd: str,
        intent: str,
        background: Union[bool, None] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[str] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> CommandResult:
        """
        Run a command with governance attestation.

        The command will only execute if SwiftAPI approves the action
        and provides a valid cryptographic attestation.

        :param cmd: Command to execute
        :param intent: Human-readable description of why this command is needed
        :param background: Run in background
        :param envs: Environment variables
        :param user: User to run as
        :param cwd: Working directory
        :param on_stdout: Stdout callback
        :param on_stderr: Stderr callback
        :param timeout: Command timeout
        :param request_timeout: Request timeout
        :return: CommandResult
        """
        params = {
            "cmd": cmd,
            "cwd": cwd,
            "user": user,
        }
        if envs:
            params["env_count"] = len(envs)

        return self._enforcement.run(
            lambda: self._commands.run(
                cmd,
                background=background,
                envs=envs,
                user=user,
                cwd=cwd,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
                timeout=timeout,
                request_timeout=request_timeout,
            ),
            action="sandbox_command",
            intent=intent,
            params=params,
            actor=self._actor,
        )


class GovernedFilesystem:
    """
    Wrapper around sandbox filesystem with SwiftAPI governance.

    Write operations require cryptographic attestation.
    """

    def __init__(
        self,
        filesystem,
        enforcement: "Enforcement",
        actor: str = "e2b-agent",
    ):
        self._filesystem = filesystem
        self._enforcement = enforcement
        self._actor = actor

    def read(self, path: str, **kwargs) -> str:
        """Read file contents. No attestation required for reads."""
        return self._filesystem.read(path, **kwargs)

    def read_bytes(self, path: str, **kwargs) -> bytes:
        """Read file as bytes. No attestation required for reads."""
        return self._filesystem.read_bytes(path, **kwargs)

    def list(self, path: str, **kwargs):
        """List directory. No attestation required for reads."""
        return self._filesystem.list(path, **kwargs)

    def exists(self, path: str, **kwargs) -> bool:
        """Check if path exists. No attestation required for reads."""
        return self._filesystem.exists(path, **kwargs)

    def write(self, path: str, data: str, intent: str, **kwargs):
        """
        Write to file with governance attestation.

        :param path: File path
        :param data: Content to write
        :param intent: Why this write is needed
        """
        return self._enforcement.run(
            lambda: self._filesystem.write(path, data, **kwargs),
            action="file_write",
            intent=intent,
            params={"path": path, "size": len(data)},
            actor=self._actor,
        )

    def write_bytes(self, path: str, data: bytes, intent: str, **kwargs):
        """
        Write bytes to file with governance attestation.

        :param path: File path
        :param data: Bytes to write
        :param intent: Why this write is needed
        """
        return self._enforcement.run(
            lambda: self._filesystem.write_bytes(path, data, **kwargs),
            action="file_write",
            intent=intent,
            params={"path": path, "size": len(data)},
            actor=self._actor,
        )

    def remove(self, path: str, intent: str, **kwargs):
        """
        Remove file with governance attestation.

        :param path: File path
        :param intent: Why this removal is needed
        """
        return self._enforcement.run(
            lambda: self._filesystem.remove(path, **kwargs),
            action="file_delete",
            intent=intent,
            params={"path": path},
            actor=self._actor,
        )

    def make_dir(self, path: str, intent: str, **kwargs):
        """
        Create directory with governance attestation.

        :param path: Directory path
        :param intent: Why this directory is needed
        """
        return self._enforcement.run(
            lambda: self._filesystem.make_dir(path, **kwargs),
            action="dir_create",
            intent=intent,
            params={"path": path},
            actor=self._actor,
        )


class GovernedSandbox:
    """
    E2B Sandbox wrapper with SwiftAPI governance.

    All mutating operations require cryptographic attestation from SwiftAPI.
    This enables fail-closed governance where AI agents can only execute
    actions that have been explicitly approved.

    Usage:
        from e2b import Sandbox
        from e2b.governance import GovernedSandbox

        sandbox = Sandbox.create()
        governed = GovernedSandbox(sandbox, swiftapi_key="swiftapi_live_...")

        # This requires attestation
        result = governed.commands.run(
            "pip install requests",
            intent="Install HTTP library for API calls"
        )
    """

    def __init__(
        self,
        sandbox,
        swiftapi_key: str,
        actor: str = "e2b-agent",
        paranoid: bool = False,
        verbose: bool = False,
    ):
        """
        Create a governed sandbox wrapper.

        :param sandbox: E2B Sandbox instance
        :param swiftapi_key: SwiftAPI authority key
        :param actor: Identifier for the agent making requests
        :param paranoid: Check revocation status online for every action
        :param verbose: Print governance status messages
        """
        if not SWIFTAPI_AVAILABLE:
            raise ImportError(
                "swiftapi-python is required for governance. "
                "Install with: pip install swiftapi-python"
            )

        self._sandbox = sandbox
        self._client = SwiftAPI(key=swiftapi_key)
        self._enforcement = Enforcement(
            self._client,
            paranoid=paranoid,
            verbose=verbose,
        )
        self._actor = actor

        self._commands = GovernedCommands(
            sandbox.commands,
            self._enforcement,
            actor=actor,
        )
        self._files = GovernedFilesystem(
            sandbox.files,
            self._enforcement,
            actor=actor,
        )

    @property
    def sandbox_id(self) -> str:
        """Get the underlying sandbox ID."""
        return self._sandbox.sandbox_id

    @property
    def commands(self) -> GovernedCommands:
        """Governed commands module."""
        return self._commands

    @property
    def files(self) -> GovernedFilesystem:
        """Governed filesystem module."""
        return self._files

    @property
    def pty(self):
        """
        PTY access is not available in governed mode.

        PTY provides direct terminal access which cannot be governed
        at the command level.
        """
        raise GovernanceError(
            "PTY access is disabled in governed mode. "
            "Use governed.commands.run() instead."
        )

    def is_running(self, **kwargs) -> bool:
        """Check if sandbox is running. No attestation required."""
        return self._sandbox.is_running(**kwargs)

    def kill(self, **kwargs) -> bool:
        """Kill the sandbox with governance attestation."""
        return self._enforcement.run(
            lambda: self._sandbox.kill(**kwargs),
            action="sandbox_kill",
            intent="Terminate sandbox instance",
            params={"sandbox_id": self._sandbox.sandbox_id},
            actor=self._actor,
        )

    def get_host(self, port: int) -> str:
        """Get host address for a port. No attestation required."""
        return self._sandbox.get_host(port)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._sandbox.kill()
