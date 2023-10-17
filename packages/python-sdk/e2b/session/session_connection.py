import asyncio
import functools
import logging
import traceback
import warnings
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from os import getenv
from time import sleep
from typing import Any, Callable, List, Literal, Optional, Union

from pydantic import BaseModel
from urllib3.exceptions import ReadTimeoutError, MaxRetryError, ConnectTimeoutError

from e2b.api import client, configuration, exceptions, models
from e2b.constants import (
    SESSION_DOMAIN,
    SESSION_REFRESH_PERIOD,
    TIMEOUT,
    ENVD_PORT,
    WS_ROUTE,
)
from e2b.session.env_vars import EnvVars
from e2b.session.exception import (
    AuthenticationException,
    MultipleExceptions,
    SessionException,
    TimeoutException,
)
from e2b.session.session_rpc import Notification, SessionRpc
from e2b.utils.future import DeferredFuture
from e2b.utils.str import camel_case_to_snake_case
from e2b.utils.threads import shutdown_executor

logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], None]


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

    def __init__(
        self,
        id: str,
        api_key: Optional[str],
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        on_close: Optional[Callable[[], Any]] = None,
        timeout: Optional[float] = TIMEOUT,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        api_key = api_key or getenv("E2B_API_KEY")

        if api_key is None:
            raise AuthenticationException(
                "API key is required, please visit https://e2b.dev/docs to get your API key",
            )

        self.cwd = cwd
        self.env_vars = env_vars or {}
        self._id = id
        self._api_key = api_key
        self._debug_hostname = _debug_hostname
        self._debug_port = _debug_port
        self._debug_dev_env = _debug_dev_env
        self._on_close_child = on_close

        self._session: Optional[models.Session] = None
        self._is_open = False
        self._process_cleanup: List[Callable[[], Any]] = []
        self._refreshing_task: Optional[asyncio.Future] = None
        self._subscribers = {}
        self._rpc: Optional[SessionRpc] = None
        self._finished = DeferredFuture(self._process_cleanup)

        logger.info(f"Session for code snippet {self._id} initialized")

        self._open(timeout=timeout)

    @classmethod
    def create(cls, *args, **kwargs):
        warnings.warn("Session.create() is deprecated, use Session() instead")
        return cls(*args, **kwargs)

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

    def close(self) -> None:
        """
        Close the session and unsubscribe from all the subscriptions.
        """
        self._close()
        logger.info(f"Session closed")

    def _close(self):
        if self._is_open and self._session:
            logger.info(
                f"Closing session {self._session.code_snippet_id} (id: {self._session.session_id})"
            )
            self._is_open = False
            if self._rpc:
                self._rpc.close()

        if self._on_close_child:
            self._on_close_child()

        self._subscribers.clear()

        for cleanup in self._process_cleanup:
            cleanup()
        self._process_cleanup.clear()

    def _open(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Open a connection to a new session.

        You must call this method before using the session.
        """
        if self._is_open or self._session:
            raise SessionException("Session connect was already called")
        else:
            self._is_open = True

        try:
            with client.ApiClient(configuration) as api_client:
                api = client.SessionsApi(api_client)

                self._session = api.sessions_post(
                    models.NewSession(codeSnippetID=self._id, editEnabled=False),
                    api_key=self._api_key,
                    _request_timeout=timeout,
                )
                logger.info(
                    f"Session {self._session.code_snippet_id} created (id:{self._session.session_id})"
                )

                # We could potentially use asyncio.to_thread() but that requires Python 3.9+
                executor = ThreadPoolExecutor(thread_name_prefix="e2b-refresh")
                self._refreshing_task = executor.submit(
                    self._refresh, self._session.session_id
                )

                self._process_cleanup.append(self._refreshing_task.cancel)
                self._process_cleanup.append(lambda: shutdown_executor(executor))

        except ReadTimeoutError as e:
            logger.error(f"Failed to acquire session")
            self._close()
            raise TimeoutException(
                f"Failed to acquire session: {e}",
            ) from e
        except MaxRetryError as e:
            if isinstance(e.reason, ConnectTimeoutError):
                raise TimeoutException(
                    f"Failed to acquire session: {e}",
                ) from e
            raise e
        except Exception as e:
            logger.error(f"Failed to acquire session")
            self._close()
            raise e

        hostname = self.get_hostname(self._debug_port or ENVD_PORT)
        protocol = "ws" if self._debug_dev_env == "local" else "wss"

        session_url = f"{protocol}://{hostname}{WS_ROUTE}"

        try:
            self._rpc = SessionRpc(
                url=session_url,
                on_message=self._handle_notification,
            )
            self._rpc.connect()
        except TimeoutError as e:
            print(e)
            raise e
        except Exception as e:
            print(e)
            self._close()
            raise e

    def _call(
        self,
        service: str,
        method: str,
        params: List[Any] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Any:
        if not params:
            params = []

        if not self.is_open:
            raise SessionException("Session is not open")

        return self._rpc.send_message(f"{service}_{method}", params, timeout=timeout)

    def _handle_subscriptions(
        self,
        *subs: Optional[Callable[[], None]],
    ):
        results: List[Union[Callable, None, Exception]] = [sub for sub in subs if sub]

        exceptions = [e for e in results if isinstance(e, Exception)]

        def unsub_all():
            return lambda: functools.reduce(
                lambda _, f: f(),
                [unsub for unsub in results if not isinstance(unsub, Exception)],
            )

        if len(exceptions) > 0:
            unsub_all()

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

    def _unsubscribe(self, sub_id: str, timeout: Optional[float] = TIMEOUT):
        sub = self._subscribers[sub_id]
        self._call(sub.service, "unsubscribe", [sub.id], timeout=timeout)
        del self._subscribers[sub_id]
        logger.debug(f"Unsubscribed (sub_id: {sub_id})")

    def _subscribe(
        self,
        service: str,
        handler: Callable[[Any], Any],
        method: str,
        *params,
        timeout: Optional[float] = TIMEOUT,
    ) -> Callable[[], None]:
        sub_id = self._call(service, "subscribe", [method, *params], timeout=timeout)
        if not isinstance(sub_id, str):
            raise Exception(f"Failed to subscribe: {camel_case_to_snake_case(method)}")

        self._subscribers[sub_id] = Subscription(
            service=service, id=sub_id, handler=handler
        )
        logger.debug(
            f"Subscribed to {service} {camel_case_to_snake_case(method)} (sub id: {sub_id})"
        )

        def unsub():
            self._unsubscribe(sub_id, timeout=timeout)

        return unsub

    def _handle_notification(self, data: Notification):
        logger.debug(f"Notification {data}")

        for id, sub in self._subscribers.items():
            if id == data.params["subscription"]:
                sub.handler(data.params["result"])

    def _refresh(self, session_id: str):
        try:
            logger.info(
                f"Started refreshing session {self._session.code_snippet_id} (id: {session_id})"
            )

            current_retry = 0

            with client.ApiClient(configuration) as api_client:
                api = client.SessionsApi(api_client)
                while True:
                    if not self._is_open:
                        logger.debug(
                            f"Cannot refresh session - it was closed. {self._session}"
                        )
                        return
                    sleep(SESSION_REFRESH_PERIOD)
                    try:
                        api.sessions_session_id_refresh_post(session_id)
                        logger.debug(f"Refreshed session {session_id}")
                    except exceptions.ApiException as e:
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
        finally:
            if self._session:
                logger.info(
                    f"Stopped refreshing session (id: {self._session.session_id})"
                )
            else:
                logger.info("No session to stop refreshing. Session was not created")

            self._close()
