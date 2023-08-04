import asyncio
import logging

from typing import Awaitable, Dict, Literal, Optional, Callable, List, Any
from pydantic import BaseModel, PrivateAttr

from e2b_sdk.utils.future import format_settled_errors, DeferredFuture
from e2b_sdk.session.rpc_websocket_client import RpcWebSocketClient
from e2b_sdk.session.code_snippet import CodeSnippetManager, CodeSnippetOpts
from e2b_sdk.session.terminal import TerminalManager
from e2b_sdk.session.filesystem import FilesystemManager
from e2b_sdk.session.process import ProcessManager
from e2b_sdk.api.client import NewSession, Session
from e2b_sdk.utils.noop import noop
from e2b_sdk.api import client, configuration
from e2b_sdk.constants import (
    SESSION_DOMAIN,
    WS_PORT,
    WS_ROUTE,
    SESSION_REFRESH_PERIOD,
)

CloseHandler = Callable[[], None]
DisconnectHandler = Callable[[], None]
ReconnectHandler = Callable[[], None]


class SessionOpts(BaseModel):
    id: str
    api_key: Optional[str]
    on_close: Optional[CloseHandler]
    on_disconnect: Optional[DisconnectHandler]
    on_reconnect: Optional[ReconnectHandler]
    debug: bool = False
    edit_enabled: bool = False
    code_snippet: Optional[CodeSnippetOpts] = None
    _debug_hostname: Optional[str] = None
    _debug_port: Optional[int] = None
    _debug_devEnv: Optional[Literal["remote", "local"]] = None


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], Awaitable[None]]


class SessionConnection(BaseModel):
    session: Optional[Session]
    subscribers: Dict[str, Subscription] = PrivateAttr(default_factory=dict)

    refreshing_task: Optional[asyncio.Task] = PrivateAttr()
    is_open: bool = PrivateAttr(default=False)

    rpc: RpcWebSocketClient = PrivateAttr()

    terminal: Optional[TerminalManager] = None
    filesystem: Optional[FilesystemManager] = None
    process: Optional[ProcessManager] = None
    code_snippet: Optional[CodeSnippetManager] = None

    opts: SessionOpts

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Session for code snippet {self.opts.id} initialized")
        self.api = client.SessionsApi(client.ApiClient(configuration, pool_threads=3))

    def get_hostname(self, port: Optional[int] = None) -> Optional[str]:
        """
        Get the hostname for the session or for the specified session's port.

        :param port: specify if you want to connect to a specific port of the session
        :return: hostname of the session or session's port
        """
        if not self.session:
            return None

        if self.opts._debug_hostname:
            if port and self.opts._debug_devEnv == "remote":
                return f"{port}-{self.opts._debug_hostname}"
            elif port:
                return f"{self.opts._debug_hostname}:{port}"
            else:
                return self.opts._debug_hostname

        hostname = (
            f"{self.session.session_id}-{self.session.client_id}.{SESSION_DOMAIN}"
        )
        if port:
            return f"{port}-{hostname}"
        return hostname

    async def close(self) -> None:
        """
        Close the session and unsubscribe from all the subscriptions.
        """
        if self.refreshing_task:
            self.refreshing_task.cancel()

        if self.is_open:
            self.logger.info(f"Closing session {self.session}")
            self.is_open = False
            self.logger.info(f"Unsubscribing from session {self.session}")
            results = await asyncio.gather(
                self.unsubscribe(id) for id, _ in self.subscribers.items()
            )
            for r in results:
                if isinstance(r, Exception):
                    self.logger.info(f"Failed to unsubscribe: {r}")
            if self.rpc:
                await self.rpc.close()
            if on_close := getattr(self.opts, "on_close", None):
                on_close()
            self.logger.info(f"Disconnected from the session {self.session}")

    async def open(self) -> None:
        """
        Open a connection to a new session
        """
        if self.is_open or self.session:
            raise Exception("Session connect was already called")
        else:
            self.is_open = True

        try:
            self.session = await self.api.sessions_post(
                NewSession(
                    codeSnippetID=self.opts.id, editEnabled=self.opts.edit_enabled
                ),
                async_req=True,
            )
            self.logger.info(f"Acquired session: {self.session}")
            self.session.session_id
            self.refreshing_task = asyncio.create_task(
                self._refresh(self.session.session_id)
            )
        except Exception as e:
            self.logger.info(f"Failed to acquire session: {e}")
            raise e

        hostname = self.get_hostname(WS_PORT)

        if not hostname:
            raise Exception("Cannot get session's hostname")

        protocol = "wss"
        session_url = f"{protocol}://{hostname}{WS_ROUTE}"

        future_open = DeferredFuture()

        async def on_close():
            self.logger.info(f"Closing WS connection to session {self.session}")
            if self.is_open:
                if self.opts.on_disconnect:
                    self.opts.on_disconnect()

                self.logger.info(f"Reconnecting to session: {self.session}")
                try:
                    await self.rpc.connect()
                    if self.opts.on_reconnect:
                        self.opts.on_reconnect()
                    self.logger.info(f"Reconnected to session: {self.session}")

                except Exception as e:
                    self.logger.info(f"Failed reconnecting to session: {e}")
            else:
                future_open.reject("Session closed")

        try:
            self.logger.info(f"Connection to session: {self.session}")
            self.rpc = RpcWebSocketClient(
                url=session_url,
                on_open=lambda: future_open(None),
                on_close=on_close,
                on_message=self.handle_notification,
                on_error=lambda e: self.logger.info(
                    f"Error in WS session: {self.session} {e}"
                ),
            )
            await self.rpc.connect()
        except Exception as e:
            self.logger.info(e)
        await future_open

        self.code_snippet = await CodeSnippetManager(
            session_connection=self, opts=self.opts.code_snippet
        )._subscribe()
        self.terminal = TerminalManager(session_connection=self)
        self.filesystem = FilesystemManager(session_connection=self)
        self.process = ProcessManager(session_connection=self)

    async def call(self, service: object, method: str, *params):
        return await self.rpc.send_message(f"{service}_{method}", *params)

    async def handle_subscriptions(self, *subs: Awaitable[str] | None):
        results: List[str | Exception | None] = await asyncio.gather(
            *[sub if sub is not None else noop() for sub in subs],
            return_exceptions=True,
        )

        if not any([isinstance(r, Exception) for r in results]):
            return [r for r in results if isinstance(r, str) or not r]

        await asyncio.gather(
            *[self.unsubscribe(r) for r in results if isinstance(r, str)],
            return_exceptions=True,
        )

        raise Exception(format_settled_errors(results))

    async def unsubscribe(self, sub_id: str):
        sub = self.subscribers[sub_id]
        await self.call(sub.service, "unsubscribe", [sub.id])
        del self.subscribers[sub_id]
        self.logger.info(f"Unsubscribed from {sub_id}")

    async def subscribe(self, service: str, handler, method: str, *params):
        sub_id = await self.call(service, "subscribe", method, *params)
        if not isinstance(sub_id, str):
            raise Exception(f"Failed to subscribe: ${sub_id}")

        self.subscribers[sub_id] = Subscription(
            service=service, id=sub_id, handler=handler
        )
        self.logger.info(
            f"Subscribed to {service}_{method} with params [{', '.join(params)}] and with id {sub_id}"
        )
        return sub_id

    def handle_notification(self, data):
        self.logger.info(f"Notification {data}")
        for id, sub in self.subscribers.items():
            if id == data.params.subscription:
                sub.handler(data.params.result)

    async def _refresh(self, session_id: str):
        self.logger.info(f"Started refreshing session {session_id}")
        try:
            while True:
                if not self.is_open:
                    self.logger.info(
                        f"Cannot refresh session - it was closed. {self.session}"
                    )
                    return
                await asyncio.sleep(SESSION_REFRESH_PERIOD)
                try:
                    await self.api.sessions_session_id_refresh_post(
                        session_id, async_req=True
                    )
                    self.logger.info(f"Refreshed session {session_id}")
                except Exception as e:
                    self.logger.info(e)
                    self.logger.info(f"Refreshing session {session_id} failed")
        finally:
            self.logger.info(f"Stopped refreshing session {session_id}")
            await self.close()
