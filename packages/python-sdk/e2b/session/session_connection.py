import asyncio
import logging

from typing import Awaitable, Literal, Optional, Callable, List, Any
from pydantic import BaseModel

from e2b.utils.future import format_settled_errors
from e2b.session.session_daemon import SessionDaemon
from e2b.api.client import NewSession, Session as SessionInfo
from e2b.utils.noop import noop
from e2b.api.main import client, configuration
from e2b.constants import (
    SESSION_DOMAIN,
    WS_PORT,
    WS_ROUTE,
    SESSION_REFRESH_PERIOD,
)

logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], Awaitable[None]]


class SessionConnection:
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
    ):
        self.id = id
        self.api_key = api_key
        self.on_close = on_close
        self.on_disconnect = on_disconnect
        self.on_reconnect = on_reconnect
        self._debug_hostname = _debug_hostname
        self._debug_port = _debug_port
        self._debug_dev_env = _debug_dev_env
        self.debug = debug
        self.edit_enabled = edit_enabled

        self.session: Optional[SessionInfo] = None
        self.is_open = False
        self.refreshing_task: Optional[asyncio.Task] = None
        self.subscribers = {}
        self.daemon: SessionDaemon

        logger.info(f"Session for code snippet {self.id} initialized")

    def get_hostname(self, port: Optional[int] = None):
        """
        Get the hostname for the session or for the specified session's port.

        :param port: specify if you want to connect to a specific port of the session
        :return: hostname of the session or session's port
        """
        if not self.session:
            raise Exception("Session is not initialized")

        if self._debug_hostname:
            if port and self._debug_dev_env == "remote":
                return f"{port}-{self._debug_hostname}"
            elif port:
                return f"{self._debug_hostname}:{port}"
            else:
                return self._debug_hostname

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
            logger.info(f"Closing session {self.session}")
            self.is_open = False
            logger.info(f"Unsubscribing from session {self.session}")
            results = await asyncio.gather(
                self.unsubscribe(id) for id, _ in self.subscribers.items()
            )
            for r in results:
                if isinstance(r, Exception):
                    logger.info(f"Failed to unsubscribe: {r}")
            if self.daemon:
                await self.daemon.close()
            if self.on_close:
                self.on_close()
            logger.info(f"Disconnected from the session {self.session}")

    async def open(self) -> None:
        """
        Open a connection to a new session
        """
        if self.is_open or self.session:
            raise Exception("Session connect was already called")
        else:
            self.is_open = True

        try:
            async with client.ApiClient(configuration) as api_client:
                api = client.SessionsApi(api_client)

                self.session = await api.sessions_post(
                    NewSession(codeSnippetID=self.id, editEnabled=self.edit_enabled),
                )
                logger.info(f"Acquired session: {self.session}")
                self.session.session_id
                self.refreshing_task = asyncio.create_task(
                    self._refresh(self.session.session_id)
                )
        except Exception as e:
            logger.info(f"Failed to acquire session: {e}")
            raise e

        hostname = self.get_hostname(WS_PORT)

        protocol = "wss"
        session_url = f"{protocol}://{hostname}{WS_ROUTE}"

        async def on_close():
            logger.info(f"Closing WS connection to session {self.session}")
            if self.is_open:
                if self.on_disconnect:
                    self.on_disconnect()

                logger.info(f"Reconnecting to session: {self.session}")
                try:
                    await self.daemon.connect()
                    if self.on_reconnect:
                        self.on_reconnect()
                    logger.info(f"Reconnected to session: {self.session}")

                except Exception as e:
                    logger.info(f"Failed reconnecting to session: {e}")

        try:
            logger.info(f"Connection to session: {self.session}")
            self.daemon = SessionDaemon(
                url=session_url,
                on_close=on_close,
                on_message=self.handle_notification,
            )
            await self.daemon.connect()
        except Exception as e:
            logger.info(e)
            raise e

    async def call(self, service: str, method: str, params: List[Any] = []):
        return await self.daemon.send_message(f"{service}_{method}", params)

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
        logger.info(f"Unsubscribed from {sub_id}")

    async def subscribe(self, service: str, handler, method: str, *params):
        sub_id = await self.call(service, "subscribe", [method, *params])
        if not isinstance(sub_id, str):
            raise Exception(f"Failed to subscribe: ${sub_id}")

        self.subscribers[sub_id] = Subscription(
            service=service, id=sub_id, handler=handler
        )
        logger.info(
            f"Subscribed to {service}_{method} with params [{', '.join(params)}] and with id {sub_id}"
        )
        return sub_id

    def handle_notification(self, data):
        logger.info(f"Notification {data}")
        for id, sub in self.subscribers.items():
            if id == data.params.subscription:
                sub.handler(data.params.result)

    async def _refresh(self, session_id: str):
        logger.info(f"Started refreshing session {session_id}")
        try:
            async with client.ApiClient(configuration) as api_client:
                api = client.SessionsApi(api_client)

                while True:
                    if not self.is_open:
                        logger.info(
                            f"Cannot refresh session - it was closed. {self.session}"
                        )
                        return
                    await asyncio.sleep(SESSION_REFRESH_PERIOD)
                    try:
                        await api.sessions_session_id_refresh_post(
                            session_id,
                        )
                        logger.info(f"Refreshed session {session_id}")
                    except Exception as e:
                        logger.info(e)
                        logger.info(f"Refreshing session {session_id} failed")
        finally:
            logger.info(f"Stopped refreshing session {session_id}")
            await self.close()
