from typing import Literal, Optional, Callable

from e2b.session.session_connection import SessionConnection
from e2b.session.code_snippet import CodeSnippetManager, ScanOpenedPortsHandler
from e2b.session.terminal import TerminalManager
from e2b.session.filesystem import FilesystemManager
from e2b.session.process import ProcessManager


class Session(SessionConnection):
    def __init__(
        self,
        id: str,
        api_key: Optional[str] = None,
        on_close: Optional[Callable[[], None]] = None,
        on_disconnect: Optional[Callable[[], None]] = None,
        on_reconnect: Optional[Callable[[], None]] = None,
        debug: bool = False,
        edit_enabled: bool = False,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
        on_scan_ports: Optional[ScanOpenedPortsHandler] = None,
    ):
        super().__init__(
            id=id,
            api_key=api_key,
            on_close=on_close,
            on_disconnect=on_disconnect,
            on_reconnect=on_reconnect,
            debug=debug,
            edit_enabled=edit_enabled,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        self.code_snippet = CodeSnippetManager(
            session=self,
            on_scan_ports=on_scan_ports,
        )
        self.terminal = TerminalManager(session=self)
        self.filesystem = FilesystemManager(session=self)
        self.process = ProcessManager(session=self)

    async def open(self) -> None:
        await super().open()
        await self.code_snippet._subscribe()
