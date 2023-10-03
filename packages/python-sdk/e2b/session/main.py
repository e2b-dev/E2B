import asyncio
import logging
from typing import Any, Callable, List, Literal, Optional, Union

from async_timeout import timeout as async_timeout

from e2b.constants import TIMEOUT
from e2b.session.code_snippet import CodeSnippetManager, OpenPort
from e2b.session.env_vars import EnvVars
from e2b.session.filesystem import FilesystemManager, SyncFilesystemManager
from e2b.session.process import ProcessManager, SyncProcessManager
from e2b.session.session_connection import SessionConnection
from e2b.session.terminal import TerminalManager, SyncTerminalManager

logger = logging.getLogger(__name__)

Environment = Literal[
    "Nodejs",
    "Bash",
    "Python3",
    "Java",
    "Go",
    "Rust",
    "PHP",
    "Perl",
    "DotNET",
]


class Session(SessionConnection):
    """
    E2B cloud environment gives your agent a full cloud development environment that's sandboxed. That means:

    - Access to Linux OS
    - Using filesystem (create, list, and delete files and dirs)
    - Run processes
    - Sandboxed - you can run any code
    - Access to the internet

    These cloud environments are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.
    """

    @property
    def process(self) -> ProcessManager:
        """
        Process manager used to run commands.
        """
        return self._process

    @property
    def terminal(self) -> TerminalManager:
        """
        Terminal manager used to create interactive terminals.
        """
        return self._terminal

    @property
    def filesystem(self) -> FilesystemManager:
        """
        Filesystem manager used to manage files.
        """
        return self._filesystem

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
        """
        Creates a new cloud environment session.

        :param id: ID of the environment or the environment type template.
        Can be one of the following environment type templates or a custom environment ID:
        - `Nodejs`
        - `Bash`
        - `Python3`
        - `Java`
        - `Go`
        - `Rust`
        - `PHP`
        - `Perl`
        - `DotNET`

        :param api_key: The API key to use, if not provided, the `E2B_API_KEY` environment variable is used
        :param cwd: The current working directory to use
        :param on_scan_ports: A callback to handle opened ports
        :param on_stdout: A default callback that is called when stdout with a newline is received from the process
        :param on_stderr: A default callback that is called when stderr with a newline is received from the process
        :param on_exit: A default callback that is called when the process exits
        """

        logger.info(f"Creating session {id if isinstance(id, str) else type(id)}")
        if cwd and cwd.startswith("~"):
            cwd = cwd.replace("~", "/home/user")

        super().__init__(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
            on_close=self._close_services,
        )
        self._code_snippet = CodeSnippetManager(
            session=self,
            on_scan_ports=on_scan_ports,
        )
        self._terminal = TerminalManager(session=self)
        self._filesystem = FilesystemManager(session=self)
        self._process = ProcessManager(
            session=self, on_stdout=on_stdout, on_stderr=on_stderr, on_exit=on_exit
        )

    async def open(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Opens the session.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.info(f"Opening session {self._id}")
        async with async_timeout(timeout):
            await super().open()
            await self._code_snippet._subscribe()
        logger.info(f"Session {self._id} opened")
        if self.cwd:
            await self.filesystem.make_dir(self.cwd)

    def _close_services(self):
        self._terminal._close()
        self._process._close()

    async def close(self) -> None:
        """
        Closes the session.
        """
        await super().close()
        await self._close()

    async def __aenter__(self):
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.close()

    @classmethod
    async def create(
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
        await session.open(timeout=timeout)
        return session


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

    @property
    def process(self) -> SyncProcessManager:
        """
        Process manager used to run commands.
        """
        return self._process

    @property
    def terminal(self) -> SyncTerminalManager:
        """
        Terminal manager used to create interactive terminals.
        """
        return self._terminal

    @property
    def filesystem(self) -> SyncFilesystemManager:
        """
        Filesystem manager used to manage files.
        """
        return self._filesystem

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
