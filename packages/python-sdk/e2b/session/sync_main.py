import asyncio
import logging
from typing import Any, Callable, List, Literal, Optional, Union

from e2b.constants import TIMEOUT
from e2b.session.code_snippet import OpenPort
from e2b.session.env_vars import EnvVars
from e2b.session.filesystem import SyncFilesystemManager
from e2b.session.main import Session, Environment
from e2b.session.process import SyncProcessManager
from e2b.session.terminal import SyncTerminalManager

logger = logging.getLogger(__name__)


class SyncSession(Session):
    """
    E2B cloud environment gives your agent a full cloud development environment that's sandboxed. That means:

    - Access to Linux OS
    - Using filesystem (create, list, and delete files and dirs)
    - Run processes
    - Sandboxed - you can run any code
    - Access to the internet

    These cloud environments are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.
    """

    def __init__(
            self,
            id: Union[Environment, str],
            api_key: Optional[str],
            cwd: Optional[str] = None,
            env_vars: Optional[EnvVars] = None,
            on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
            on_stdout: Optional[Callable[[str], Any]] = None,
            on_stderr: Optional[Callable[[str], Any]] = None,
            on_exit: Optional[Callable[[int], Any]] = None,
            _debug_hostname: Optional[str] = None,
            _debug_port: Optional[int] = None,
            _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        super().__init__(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            on_scan_ports=on_scan_ports,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        self._loop = asyncio.get_event_loop()
        asyncio.set_event_loop(self._loop)
        self._process = SyncProcessManager(self, self._loop)
        self._filesystem = SyncFilesystemManager(self, self._loop)
        self._terminal = SyncTerminalManager(self, self._loop)

    def open(self, timeout: Optional[float] = TIMEOUT):
        """
        Opens the session.
        """
        return self._loop.run_until_complete(super().open(timeout))

    def _close_services(self):
        self._terminal._close()
        self._process._close()

    def close(self) -> None:
        """
        Closes the session.
        """
        self._loop.run_until_complete(super().close())
        self._loop.close()

    def __enter__(self, timeout: Optional[float] = TIMEOUT):
        self.open(timeout)
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    @classmethod
    def create(
            cls,
            id: Union[Environment, str],
            api_key: Optional[str] = None,
            cwd: Optional[str] = None,
            env_vars: Optional[EnvVars] = None,
            on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
            on_stdout: Optional[Callable[[str], Any]] = None,
            on_stderr: Optional[Callable[[str], Any]] = None,
            on_exit: Optional[Callable[[int], Any]] = None,
            timeout: Optional[float] = TIMEOUT,
            _debug_hostname: Optional[str] = None,
            _debug_port: Optional[int] = None,
            _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        """
        Creates a new cloud environment session.

        :param id: ID of the environment or the environment type template.
        Can be one of the following environment type templates or a custom environment ID:
        - `Nodejs`
        - `Bash`
        - `Python`
        - `Java`
        - `Go`
        - `Rust`
        - `PHP`
        - `Perl`
        - `DotNET`

        :param api_key: The API key to use
        :param cwd: The current working directory to use
        :param env_vars: Environment variables to set
        :param on_scan_ports: A callback to handle opened ports
        :param on_stdout: A default callback that is called when stdout with a newline is received from the process
        :param on_stderr: A default callback that is called when stderr with a newline is received from the process
        :param on_exit: A default callback that is called when the process exits
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        session = cls(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            on_scan_ports=on_scan_ports,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        session.open(timeout=timeout)
        return session
