import asyncio
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Awaitable, Callable, List, Literal, Optional, Union

import async_timeout
from e2b.api.client import NewSession
from e2b.api.client import Session as SessionInfo
from e2b.api.client.rest import ApiException
from e2b.api.main import client, configuration
from e2b.constants import (
    SESSION_DOMAIN,
    SESSION_REFRESH_PERIOD,
    TIMEOUT,
    WS_PORT,
    WS_ROUTE,
)
from e2b.session.exception import (
    AuthenticationException,
    MultipleExceptions,
    SessionException,
)
from e2b.session.session_rpc import Notification, SessionRpc
from e2b.utils.future import DeferredFuture, run_async_func_in_new_loop
from e2b.utils.noop import noop
from e2b.utils.str import camel_case_to_snake_case
from e2b.utils.threads import shutdown_executor
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], Awaitable[None]]


class SessionConnection:
    _refresh_retries = 4

    @property
    def finished(self):
        """
        A future that is resolved when the session exits.
        """
        return self._finished

    @property
    def is_open(self) -> bool:
        """
        Whether the session is open.
        """
        return self._is_open

    def __await__(self):
        return self._finished.__await__()

    def __init__(
        self,
        id: str,
        api_key: str,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
        on_close: Optional[Callable[[], Any]] = None,
    ):
        if api_key is None:
            raise AuthenticationException(
                "API key is required, please visit https://e2b.dev/docs to get your API key",
            )

        self._id = id
        self._api_key = api_key
        self._debug_hostname = _debug_hostname
        self._debug_port = _debug_port
        self._debug_dev_env = _debug_dev_env
        self._on_close_child = on_close

        self._session: Optional[SessionInfo] = None
        self._is_open = False
        self._process_cleanup: List[Callable[[], Any]] = []
        self._refreshing_task: Optional[asyncio.Future] = None
        self._subscribers = {}
        self._rpc: Optional[SessionRpc] = None
        self._finished = DeferredFuture(self._process_cleanup)

        logger.info(f"Session for code snippet {self._id} initialized")

    def get_hostname(self, port: Optional[int] = None):
        """
        Get the hostname for the session or for the specified session's port.

        :param port: Specify if you want to connect to a specific port of the session

        :return: Hostname of the session or session's port
        """
        if not self._session:
            raise SessionException(
                "Session is not running. You have to run `await session.open()` first or create the session with `await Session.create()"
            )

        if self._debug_hostname:
            if port and self._debug_dev_env == "remote":
                return f"{port}-{self._debug_hostname}"
            elif port:
                return f"{self._debug_hostname}:{port}"
            else:
                return self._debug_hostname

        hostname = (
            f"{self._session.session_id}-{self._session.client_id}.{SESSION_DOMAIN}"
        )
        if port:
            return f"{port}-{hostname}"
        return hostname

    async def close(self) -> None:
        """
        Close the session and unsubscribe from all the subscriptions.
        """
        if self._is_open and self._session:
            logger.info(
                f"Closing session {self._session.code_snippet_id} (id: {self._session.session_id})"
            )
            self._is_open = False
            if self._rpc:
                await self._rpc.close()

        self._close()
        logger.info(
            f"Session closed"
        )

    def _close(self):
        if self._on_close_child:
            self._on_close_child()

        self._subscribers.clear()

        for cleanup in self._process_cleanup:
            cleanup()
        self._process_cleanup.clear()

    async def open(self) -> None:
        """
        Open a connection to a new session.

        You must call this method before using the session.
        """
        if self._is_open or self._session:
            raise SessionException("Session connect was already called")
        else:
            self._is_open = True

        try:
            async with client.ApiClient(configuration) as api_client:
                api = client.SessionsApi(api_client)

                self._session = await api.sessions_post(
                    NewSession(codeSnippetID=self._id, editEnabled=False),
                    api_key=self._api_key,
                )
                logger.info(
                    f"Session {self._session.code_snippet_id} created (id:{self._session.session_id})"
                )

                # We could potentially use asyncio.to_thread() but that requires Python 3.9+
                executor = ThreadPoolExecutor()
                self._refreshing_task = asyncio.get_running_loop().run_in_executor(
                    executor,
                    run_async_func_in_new_loop,
                    self._refresh(self._session.session_id),
                )

                self._process_cleanup.append(self._refreshing_task.cancel)
                self._process_cleanup.append(lambda: shutdown_executor(executor))

                async def refresh_cleanup():
                    try:
                        if self._refreshing_task:
                            await self._refreshing_task
                    finally:
                        if self._session:
                            logger.info(
                                f"Stopped refreshing session (id: {self._session.session_id})"
                            )
                        else:
                            logger.info(
                                "No session to stop refreshing. Session was not created"
                            )

                        await self.close()

                refresh_handler = asyncio.create_task(refresh_cleanup())
                self._process_cleanup.append(refresh_handler.cancel)
        except Exception as e:
            logger.error(f"Failed to acquire session")
            await self.close()
            raise e

        hostname = self.get_hostname(self._debug_port or WS_PORT)
        protocol = "ws" if self._debug_dev_env == "local" else "wss"

        session_url = f"{protocol}://{hostname}{WS_ROUTE}"

        try:
            self._rpc = SessionRpc(
                url=session_url,
                on_message=self._handle_notification,
            )
            await self._rpc.connect()
        except Exception as e:
            await self.close()
            raise e

    async def _call(
        self,
        service: str,
        method: str,
        params: List[Any] = None,
        timeout: Optional[float] = TIMEOUT,
    ):
        if not params:
            params = []

        if not self.is_open:
            raise SessionException("Session is not open")

        async with async_timeout.timeout(timeout):
            return await self._rpc.send_message(f"{service}_{method}", params)

    async def _handle_subscriptions(
        self,
        *subs: Optional[Awaitable[Callable[[], Awaitable[None]]]],
    ):
        results: List[
            Union[Callable[[], Awaitable[None]], None, Exception]
        ] = await asyncio.gather(
            *[sub if sub else noop() for sub in subs],
            return_exceptions=True,
        )

        exceptions = [e for e in results if isinstance(e, Exception)]

        async def unsub_all():
            return await asyncio.gather(
                *[
                    unsub()
                    for unsub in results
                    if not isinstance(unsub, Exception) and unsub
                ],
                return_exceptions=True,
            )

        if len(exceptions) > 0:
            await unsub_all()

            if len(exceptions) == 1:
                raise exceptions[0]

            error_message = "\n"

            for i, s in enumerate(exceptions):
                tb = s.__traceback__  # Get the traceback object
                stack_trace = "\n".join(traceback.extract_tb(tb).format())
                error_message += f'\n[{i}]: {type(s).__name__}("{s}"):\n{stack_trace}\n'

            raise MultipleExceptions(
                message=error_message,
                exceptions=exceptions,
            )

        return unsub_all

    async def _unsubscribe(self, sub_id: str, timeout: Optional[float] = TIMEOUT):
        sub = self._subscribers[sub_id]
        await self._call(sub.service, "unsubscribe", [sub.id], timeout=timeout)
        del self._subscribers[sub_id]
        logger.debug(f"Unsubscribed (sub_id: {sub_id})")

    async def _subscribe(
        self,
        service: str,
        handler: Callable[[Any], Any],
        method: str,
        *params,
        timeout: Optional[float] = TIMEOUT,
    ):
        sub_id = await self._call(
            service, "subscribe", [method, *params], timeout=timeout
        )
        if not isinstance(sub_id, str):
            raise Exception(f"Failed to subscribe: {camel_case_to_snake_case(method)}")

        self._subscribers[sub_id] = Subscription(
            service=service, id=sub_id, handler=handler
        )
        logger.info(f"Subscribed to {service} {camel_case_to_snake_case(method)}")

        async def unsub():
            await self._unsubscribe(sub_id, timeout=timeout)

        return unsub

    def _handle_notification(self, data: Notification):
        logger.debug(f"Notification {data}")

        for id, sub in self._subscribers.items():
            if id == data.params["subscription"]:
                sub.handler(data.params["result"])

    async def _refresh(self, session_id: str):
        logger.info(
            f"Started refreshing session {self._session.code_snippet_id} (id: {session_id})"
        )

        current_retry = 0

        async with client.ApiClient(configuration) as api_client:
            api = client.SessionsApi(api_client)
            while True:
                if not self._is_open:
                    logger.debug(
                        f"Cannot refresh session - it was closed. {self._session}"
                    )
                    return
                await asyncio.sleep(SESSION_REFRESH_PERIOD)
                try:
                    await api.sessions_session_id_refresh_post(
                        session_id,
                    )
                    logger.debug(f"Refreshed session {session_id}")
                except ApiException as e:
                    if e.status == 404:
                        raise SessionException(
                            f"Session {session_id} failed because it cannot be found"
                        ) from e
                    else:
                        if current_retry < self._refresh_retries:
                            logger.error(
                                f"Refreshing session {session_id} failed. Retrying..."
                            )
                            current_retry += 1
                        else:
                            logger.error(
                                f"Refreshing session {session_id} failed. Max retries exceeded"
                            )
                            raise e
