import concurrent
import logging
import threading
import traceback
import warnings

from concurrent.futures import ThreadPoolExecutor, CancelledError
from time import sleep
from typing import Any, Callable, List, Literal, Optional, Union, Dict
from datetime import datetime
from pydantic import BaseModel
from urllib3.exceptions import ReadTimeoutError, MaxRetryError, ConnectTimeoutError


from e2b.api import E2BApiClient, exceptions, models, client
from e2b.constants import (
    SANDBOX_DOMAIN,
    SANDBOX_REFRESH_PERIOD,
    TIMEOUT,
    ENVD_PORT,
    WS_ROUTE,
    SECURE,
)
from e2b.sandbox.env_vars import EnvVars
from e2b.sandbox.exception import (
    MultipleExceptions,
    SandboxException,
    TimeoutException,
    SandboxNotOpenException,
)
from e2b.sandbox.sandbox_rpc import Notification, SandboxRpc
from e2b.utils.api_key import get_api_key
from e2b.utils.future import DeferredFuture
from e2b.utils.str import camel_case_to_snake_case


logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], None]


class SubscriptionArgs(BaseModel):
    service: str
    handler: Callable[[Any], None]
    method: str
    params: List[Any] = []


class RunningSandbox(BaseModel):
    sandbox_id: str
    template_id: str
    alias: Optional[str]
    metadata: Dict[str, str] | None
    started_at: datetime


class SandboxConnection:
    _refresh_retries = 4
    _on_close_child: Optional[Callable[[], Any]] = None

    @property
    def id(self) -> str:
        """
        The sandbox ID.

        You can use this ID to reconnect to the sandbox later.
        """
        if not self._sandbox:
            raise SandboxException("Sandbox is not running.")
        return f"{self._sandbox.sandbox_id}-{self._sandbox.client_id}"

    @property
    def finished(self):
        """
        A future that is resolved when the sandbox exits.
        """
        return self._finished

    @property
    def is_open(self) -> bool:
        """
        Whether the sandbox is open.
        """
        return self._is_open

    def __init__(
        self,
        template: str,
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        metadata: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = TIMEOUT,
        _sandbox: Optional[models.Sandbox] = None,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        api_key = get_api_key(api_key)

        self.cwd = cwd
        """
        Default working directory used in the sandbox.

        You can change the working directory by setting the `cwd` property.
        """
        self.env_vars = env_vars or {}
        """
        Default environment variables used in the sandbox.

        You can change the environment variables by setting the `env_vars` property.
        """
        self._template = template
        self._api_key = api_key
        self._debug_hostname = _debug_hostname
        self._debug_port = _debug_port
        self._debug_dev_env = _debug_dev_env
        self._sandbox = _sandbox

        self._is_open = False
        self._process_cleanup: List[Callable[[], Any]] = []
        self._subscribers = {}
        self._rpc: Optional[SandboxRpc] = None
        self._finished = DeferredFuture(self._process_cleanup)

        logger.info(f"Sandbox for template {self._template} initialized")

        self._open(metadata=metadata, timeout=timeout)

    @classmethod
    def create(cls, *args, **kwargs):
        warnings.warn("Sandbox.create() is deprecated, use Sandbox() instead")
        return cls(*args, **kwargs)

    def get_hostname(self, port: Optional[int] = None) -> str:
        """
        Get the hostname for the sandbox or for the specified sandbox's port.

        :param port: Specify if you want to connect to a specific port of the sandbox

        :return: Hostname of the sandbox or sandbox's port
        """

        if self._debug_hostname:
            if port and self._debug_dev_env == "remote":
                return f"{port}-{self._debug_hostname}"
            elif port:
                return f"{self._debug_hostname}:{port}"
            else:
                return self._debug_hostname
        else:
            if not self._sandbox:
                raise SandboxException("Sandbox is not running.")

        hostname = f"{self.id}.{SANDBOX_DOMAIN}"

        if port:
            return f"{port}-{hostname}"

        return hostname

    @staticmethod
    def get_protocol(base_protocol: str = "http", secure: bool = SECURE) -> str:
        """
        The function decides whether to use the secure or insecure protocol.

        :param base_protocol: Specify the specific protocol you want to use. Do not include the `s` in `https` or `wss`.
        :param secure: Specify whether you want to use the secure protocol or not.

        :return: Protocol for the connection to the sandbox
        """
        return f"{base_protocol}s" if secure else base_protocol

    def keep_alive(self, duration: int) -> None:
        """
        Keep the sandbox alive for the specified duration.

        :param duration: Duration in seconds. Must be between 0 and 3600 seconds.
        """
        if not 0 <= duration <= 3600:
            raise ValueError("Duration must be between 0 and 3600 seconds")

        with E2BApiClient(api_key=self._api_key) as api_client:
            api = client.SandboxesApi(api_client)
            try:
                api.sandboxes_sandbox_id_refreshes_post(
                    self._sandbox.sandbox_id,
                    client.SandboxesSandboxIDRefreshesPostRequest(duration=duration),
                )
                logger.debug(
                    f"Sandbox will be kept alive without connection for next {duration} seconds."
                )
            except exceptions.ApiException as e:
                if e.status == 404:
                    raise SandboxException(
                        f"Sandbox {self.id} failed because it cannot be found"
                    ) from e
                else:
                    raise e

    def close(self) -> None:
        """
        Close the sandbox and unsubscribe from all the subscriptions.
        """
        self._close()
        logger.info(f"Sandbox closed")

    def _close(self):
        if self._is_open and self._sandbox:
            logger.info(f"Closing sandbox {self._sandbox.template_id} (id: {self.id})")
            self._is_open = False
            if self._rpc:
                self._rpc.close()

        if self._on_close_child:
            self._on_close_child()

        for cleanup in self._process_cleanup:
            cleanup()
        self._process_cleanup.clear()

    def _open(
        self,
        metadata: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> None:
        """
        Open a connection to a new sandbox.

        You must call this method before using the sandbox.
        """
        if self._is_open:
            raise SandboxException("Sandbox connect was already called")
        else:
            self._is_open = True

        if not self._sandbox and not self._debug_hostname:
            try:
                with E2BApiClient(api_key=self._api_key) as api_client:
                    api = client.SandboxesApi(api_client)

                    self._sandbox = api.sandboxes_post(
                        models.NewSandbox(templateID=self._template, metadata=metadata),
                        _request_timeout=timeout,
                    )
                    logger.info(
                        f"Sandbox {self._sandbox.template_id} created (id:{self.id})"
                    )
            except ReadTimeoutError as e:
                logger.error(f"Failed to acquire sandbox")
                self._close()
                raise TimeoutException(
                    f"Failed to acquire sandbox: {e}",
                ) from e
            except MaxRetryError as e:
                if isinstance(e.reason, ConnectTimeoutError):
                    raise TimeoutException(
                        f"Failed to acquire sandbox: {e}",
                    ) from e
                raise e
            except Exception as e:
                logger.error(f"Failed to acquire sandbox")
                self._close()
                raise e

        if not self._debug_hostname:
            self._start_refreshing()

        try:
            self._connect_rpc(timeout)
        except Exception as e:
            logger.error(e)
            self._close()
            raise e

    def _connect_rpc(self, timeout: Optional[float] = TIMEOUT):
        hostname = self.get_hostname(self._debug_port or ENVD_PORT)
        protocol = self.get_protocol("ws", self._debug_dev_env != "local")
        sandbox_url = f"{protocol}://{hostname}{WS_ROUTE}"

        self._rpc = SandboxRpc(
            url=sandbox_url,
            on_message=self._handle_notification,
        )
        self._rpc.connect(timeout=timeout)

    def _start_refreshing(self):
        threading.Thread(
            target=self._refresh,
            args=(self._sandbox.sandbox_id,),
            daemon=True,
            name="e2b-sandbox-refresh",
        ).start()

    def _call(
        self,
        service: str,
        method: str,
        params: Optional[List[Any]] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Any:
        if not params:
            params = []

        if not self.is_open:
            raise SandboxNotOpenException("Sandbox is not open")

        if not self._rpc:
            raise SandboxException("Sandbox is not connected")

        return self._rpc.send_message(f"{service}_{method}", params, timeout)

    def _handle_subscriptions(
        self,
        *subscription_args: SubscriptionArgs,
    ):
        results: List[Union[Callable, None, Exception]] = []
        with ThreadPoolExecutor(thread_name_prefix="process-subscribe") as executor:
            futures = []
            for args in subscription_args:
                future = executor.submit(
                    self._subscribe,
                    args.service,
                    args.handler,
                    args.method,
                    *args.params,
                )
                futures.append(future)

            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())

        results = [sub for sub in results if sub]
        process_exceptions = [e for e in results if isinstance(e, Exception)]

        def unsub_all():
            def unsub_func():
                for unsub in results:
                    if not isinstance(unsub, Exception):
                        try:
                            unsub()
                        except (CancelledError, SandboxNotOpenException, KeyError):
                            pass

            threading.Thread(
                name="process-unsubscribe",
                daemon=True,
                target=unsub_func,
            ).start()

        if len(process_exceptions) > 0:
            unsub_all()

            if len(process_exceptions) == 1:
                raise process_exceptions[0]

            error_message = "\n"

            for i, s in enumerate(process_exceptions):
                tb = s.__traceback__  # Get the traceback object
                stack_trace = "\n".join(traceback.extract_tb(tb).format())
                error_message += f'\n[{i}]: {type(s).__name__}("{s}"):\n{stack_trace}\n'

            raise MultipleExceptions(
                message=error_message,
                exceptions=process_exceptions,
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

    def _refresh(self, sandbox_id: str):
        if not self._sandbox:
            logger.info("No sandbox to refresh. Sandbox was not created")
            return

        try:
            logger.info(
                f"Started refreshing sandbox {self._sandbox.template_id} (id: {self.id})"
            )

            current_retry = 0

            with E2BApiClient(api_key=self._api_key) as api_client:
                api = client.SandboxesApi(api_client)
                while True:
                    if not self._is_open:
                        logger.debug(
                            f"Cannot refresh sandbox - it was closed. {self.id}"
                        )
                        return
                    sleep(SANDBOX_REFRESH_PERIOD)
                    try:
                        api.sandboxes_sandbox_id_refreshes_post(
                            sandbox_id,
                            client.SandboxesSandboxIDRefreshesPostRequest(duration=0),
                        )
                        logger.debug(f"Refreshed sandbox {self.id}")
                    except exceptions.ApiException as e:
                        if e.status == 404:
                            raise SandboxException(
                                f"Sandbox {self.id} failed because it cannot be found"
                            ) from e
                        else:
                            if current_retry < self._refresh_retries:
                                logger.error(
                                    f"Refreshing sandbox {self.id} failed. Retrying..."
                                )
                                current_retry += 1
                            else:
                                logger.error(
                                    f"Refreshing sandbox {self.id} failed. Max retries exceeded"
                                )
                                raise e
        finally:
            if self._sandbox:
                logger.info(f"Stopped refreshing sandbox (id: {self.id})")
            else:
                logger.info("No sandbox to stop refreshing. Sandbox was not created")

            self._close()

    @staticmethod
    def list(api_key: Optional[str] = None) -> List[RunningSandbox]:
        """
        List all running sandboxes.

        :param api_key: API key to use for authentication.
        If not provided, the `E2B_API_KEY` environment variable will be used.
        """
        api_key = get_api_key(api_key)

        with E2BApiClient(api_key=api_key) as api_client:
            return [
                RunningSandbox(
                    metadata=sandbox.metadata,
                    sandbox_id=f"{sandbox.sandbox_id}-{sandbox.client_id}",
                    template_id=sandbox.template_id,
                    alias=sandbox.alias,
                    started_at=sandbox.started_at,
                )
                for sandbox in client.SandboxesApi(api_client).sandboxes_get()
            ]
