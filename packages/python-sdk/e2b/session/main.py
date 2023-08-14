import logging

from typing import Literal, Optional, Callable, List, Any

from e2b.session.session_connection import SessionConnection
from e2b.session.code_snippet import CodeSnippetManager, OpenPort
from e2b.session.terminal import TerminalManager
from e2b.session.filesystem import FilesystemManager
from e2b.session.process import ProcessManager

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
    def process(self):
        """
        Process manager used to run commands.
        """
        return self._process

    @property
    def terminal(self):
        """
        Terminal manager used to create interactive terminals.
        """
        return self._terminal

    @property
    def filesystem(self):
        """
        Filesystem manager used to manage files.
        """
        return self._filesystem

    def __init__(
        self,
        id: Environment | str,
        api_key: Optional[str] = None,
        edit_enabled: bool = False,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
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

        :param api_key: The API key to use
        :param edit_enabled: Whether the session state will be saved after exit
        :param on_scan_ports: A callback to handle opened ports
        """

        logging.info(f"Session {id if isinstance(id, str) else type(id)}")
        super().__init__(
            id=id,
            api_key=api_key,
            edit_enabled=edit_enabled,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        self._code_snippet = CodeSnippetManager(
            session=self,
            on_scan_ports=on_scan_ports,
        )
        self._terminal = TerminalManager(session=self)
        self._filesystem = FilesystemManager(session=self)
        self._process = ProcessManager(session=self)

    async def open(self) -> None:
        await super().open()
        await self._code_snippet._subscribe()

    async def close(self) -> None:
        self._terminal._close()
        self._process._close()
        await super().close()

    @classmethod
    async def create(
        cls,
        id: Environment | str,
        api_key: Optional[str] = None,
        edit_enabled: bool = False,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
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
        :param edit_enabled: Whether the session state will be saved after exit
        :param on_scan_ports: A callback to handle opened ports
        """

        logging.info(f"Session {id if isinstance(id, str) else type(id)}")
        session = cls(
            id=id,
            api_key=api_key,
            edit_enabled=edit_enabled,
            on_scan_ports=on_scan_ports,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        await session.open()
        return session
