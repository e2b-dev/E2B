import asyncio
from asyncio.tasks import _FutureLike
import logging

from typing import Awaitable, Literal, Optional, Callable, List, Coroutine, Union, Any

from pydantic import BaseModel, PrivateAttr
from rpc_socket import RpcWebSocketClient

from e2b_sdk.api.client import NewSession, Session
from e2b_sdk.utils.noop import noop
from e2b_sdk.api import client, configuration
from e2b_sdk.constants import (
    SESSION_DOMAIN,
    WS_PORT,
    WS_ROUTE,
    WS_RECONNECT_INTERVAL,
    SESSION_REFRESH_PERIOD,
)

CloseHandler = Callable[[], None]
DisconnectHandler = Callable[[], None]
ReconnectHandler = Callable[[], None]


class SessionConnectionOpts(BaseModel):
    ip: str
    api_key: Optional[str]
    on_close: Optional[CloseHandler]
    on_disconnect: Optional[DisconnectHandler]
    on_reconnect: Optional[ReconnectHandler]
    debug: bool = False
    edit_enabled: bool = False
    _debug_hostname: Optional[str] = None
    _debug_port: Optional[int] = None
    _debug_devEnv: Optional[Literal["remote"] | Literal["local"]] = None


class SessionConnection(BaseModel):
    is_open: bool = False
    session: Optional[Session] = None

    _rpc: Optional[RpcWebSocketClient] = PrivateAttr()

    def __init__(self, opts):
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Session for code snippet {opts.id} initialized")
        self.is_open = False
        self.is_finished = False
        self.subscribers = []
        self.session = None
        self.rpc = None
        self.opts = opts or {}
        self.refreshing_task = None
        self.api = client.SessionsApi(client.ApiClient(configuration, pool_threads=3))
        self.session: Session | None = None

    def get_hostname(self, port: Optional[int] = None) -> Optional[str]:
        """
        Get the hostname for the session or for the specified session's port.
        :param port: specify if you want to connect to a specific port of the session
        :return: hostname of the session or session's port
        """
        if not self.session:
            return None

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
                *[self.unsubscribe(s.subID) for s in self.subscribers]
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

        self.is_finished = False
        opening_promise = asyncio.Future()

        async def on_open():
            self.logger.info(f"Connected to session {self.session}")
            if self.is_finished:
                return
            self.is_finished = True
            opening_promise.set_result(None)

        def reject():
            if self.is_finished:
                return
            self.is_finished = True
            opening_promise.set_exception(Exception)

        async def on_close():
            self.logger.info(f"Closing WS connection to session {self.session}")
            if self.is_open:
                if on_disconnect := getattr(self.opts, "on_disconnect", None):
                    on_disconnect()

                await asyncio.sleep(WS_RECONNECT_INTERVAL)
                self.subscribers = []

                self.logger.info(f"Reconnecting to session: {self.session}")
                try:
                    self.rpc = await self.rpc.connect()
                    if on_reconnect := getattr(self.opts, "on_reconnect", None):
                        on_reconnect()
                    self.logger.info(f"Reconnected to session: {self.session}")

                except Exception as e:
                    self.logger.info(f"Failed reconnecting to session: {e}")
            else:
                reject()

        try:
            self.logger.info(f"Connection to session: {self.session}")
            self.rpc = RpcWebSocketClient(
                session_url,
                on_open=on_open,
                on_close=on_close,
                on_message=self.handle_notification,
                on_error=lambda e: self.logger.info(
                    f"Error in WS session: {self.session} {e}"
                ),
            )
            await self.rpc.connect()
        except Exception as e:
            self.logger.info(e)
        await opening_promise

    async def call(self, service: object, method: str, *params):
        # Not sure about this
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

        raise Exception(self.format_settled_errors(results))

    async def unsubscribe(self, subscription_id: str):
        for subscription in self.subscribers:
            if subscription["subID"] == subscription_id:
                await subscription.service.unsubscribe(subscription_id)
                break
        else:
            return
        await self.call(subscription["service"], "unsubscribe", [subscription["subID"]])
        self.subscribers = [s for s in self.subscribers if s != subscription]
        self.logger.info(f"Unsubscribed from {subscription_id}")

    async def subscribe(self, service: str, handler, method: str, *params):
        subscription_id = await self.call(service, "subscribe", method, *params)
        if not isinstance(subscription_id, str):
            raise Exception()
        self.subscribers.append(
            {"service": service, "subID": subscription_id, "handler": handler}
        )
        self.logger.info(
            f"Subscribed to {service}_{method} with params [{', '.join(params)}] and with id {subscription_id}"
        )
        return subscription_id

    def handle_notification(self, data):
        self.logger.info(f"Notification {data}")
        for s in self.subscribers:
            if s["subID"] == data.params.subscription:
                s["handler"](data.params.result)

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
