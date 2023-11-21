import functools
import logging
import traceback
import warnings
from concurrent.futures import ThreadPoolExecutor, Future
from os import getenv
from time import sleep
from typing import Any, Callable, List, Literal, Optional, Union

from pydantic import BaseModel
from urllib3.exceptions import ReadTimeoutError, MaxRetryError, ConnectTimeoutError

from e2b.api import E2BApiClient, exceptions, models, client
from e2b.constants import (
    SANDBOX_DOMAIN,
    SANDBOX_REFRESH_PERIOD,
    TIMEOUT,
    ENVD_PORT,
    WS_ROUTE,
)
from e2b.sandbox.env_vars import EnvVars
from e2b.sandbox.exception import (
    AuthenticationException,
    MultipleExceptions,
    SandboxException,
    TimeoutException,
)
from e2b.sandbox.sandbox_rpc import Notification, SandboxRpc
from e2b.utils.future import DeferredFuture
from e2b.utils.str import camel_case_to_snake_case
from e2b.utils.threads import shutdown_executor

logger = logging.getLogger(__name__)


class Subscription(BaseModel):
    service: str
    id: str
    handler: Callable[[Any], None]


class SandboxConnection:
    _refresh_retries = 4
    _on_close_child: Optional[Callable[[], Any]] = None

    @property
    def id(self) -> str:
        """
        The sandbox ID.
        """
        if not self._sandbox:
            raise SandboxException("Sandbox is not running.")
        return f"{self._sandbox.instance_id}-{self._sandbox.client_id}"

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
        id: str,
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        timeout: Optional[float] = TIMEOUT,
        _sandbox: Optional[models.Instance] = None,
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
        self._sandbox = _sandbox

        self._is_open = False
        self._process_cleanup: List[Callable[[], Any]] = []
        self._refreshing_task: Optional[Future] = None
        self._subscribers = {}
        self._rpc: Optional[SandboxRpc] = None
        self._finished = DeferredFuture(self._process_cleanup)

        logger.info(f"Sandbox for template {self._id} initialized")

        self._open(timeout=timeout)

    @classmethod
    def create(cls, *args, **kwargs):
        warnings.warn("Sandbox.create() is deprecated, use Sandbox() instead")
        return cls(*args, **kwargs)

    @classmethod
    def reconnect(
        cls,
        sandbox_id: str,
        *args,
        **kwargs,
    ):
        logger.info(f"Reconnecting to sandbox {sandbox_id}")
        instance_id, client_id = sandbox_id.split("-")
        return cls(
            *args,
            _sandbox=models.Instance(
                instance_id=instance_id,
                client_id=client_id,
                env_id=getattr(cls, "sandbox_template_id", "unknown"),
            ),
            **kwargs,
        )

    def get_hostname(self, port: Optional[int] = None):
        """
        Get the hostname for the sandbox or for the specified sandbox's port.

        :param port: Specify if you want to connect to a specific port of the sandbox

        :return: Hostname of the sandbox or sandbox's port
        """
        if not self._sandbox:
            raise SandboxException("Sandbox is not running.")

        if self._debug_hostname:
            if port and self._debug_dev_env == "remote":
                return f"{port}-{self._debug_hostname}"
            elif port:
                return f"{self._debug_hostname}:{port}"
            else:
                return self._debug_hostname

        hostname = f"{self.id}.{SANDBOX_DOMAIN}"
        if port:
            return f"{port}-{hostname}"
        return hostname

    def keep_alive(self, duration: int) -> None:
        if not 0 <= duration <= 3600:
            raise ValueError("Duration must be between 0 and 3600 seconds")

        with E2BApiClient(api_key=self._api_key) as api_client:
            api = client.InstancesApi(api_client)
            try:
                api.instances_instance_id_refreshes_post(
                    self._sandbox.instance_id,
                    client.InstancesInstanceIDRefreshesPostRequest(duration=duration),
                )
                logger.debug(
                    f"Sandbox will be kept alive without connection for next {duration} seconds."
                )
            except exceptions.ApiException as e:
                if e.status == 404:
                    raise SandboxException(
                        f"Sandbox {self._sandbox.instance_id} failed because it cannot be found"
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
            logger.info(
                f"Closing sandbox {self._sandbox.env_id} (id: {self._sandbox.instance_id})"
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
        Open a connection to a new sandbox.

        You must call this method before using the sandbox.
        """
        if self._is_open:
            raise SandboxException("Sandbox connect was already called")
        else:
            self._is_open = True

        if not self._sandbox:
            try:
                with E2BApiClient(api_key=self._api_key) as api_client:
                    api = client.InstancesApi(api_client)

                    self._sandbox = api.instances_post(
                        models.NewInstance(envID=self._id),
                        _request_timeout=timeout,
                    )
                    logger.info(
                        f"Sandbox {self._sandbox.env_id} created (id:{self._sandbox.instance_id})"
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

        self._start_refreshing()
        try:
            self._connect_rpc(timeout)
        except Exception as e:
            print(e)
            self._close()
            raise e

    def _connect_rpc(self, timeout: Optional[float] = TIMEOUT):
        hostname = self.get_hostname(self._debug_port or ENVD_PORT)
        protocol = "ws" if self._debug_dev_env == "local" else "wss"

        sandbox_url = f"{protocol}://{hostname}{WS_ROUTE}"
        self._rpc = SandboxRpc(
            url=sandbox_url,
            on_message=self._handle_notification,
        )
        self._rpc.connect(timeout=timeout)

    def _start_refreshing(self):
        executor = ThreadPoolExecutor(thread_name_prefix="e2b-refresh")
        self._refreshing_task = executor.submit(
            self._refresh, self._sandbox.instance_id
        )

        self._process_cleanup.append(self._refreshing_task.cancel)
        self._process_cleanup.append(lambda: shutdown_executor(executor))

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
            raise SandboxException("Sandbox is not open")

        if not self._rpc:
            raise SandboxException("Sandbox is not connected")

        return self._rpc.send_message(f"{service}_{method}", params, timeout)

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

    def _refresh(self, instance_id: str):
        if not self._sandbox:
            logger.info("No sandbox to refresh. Sandbox was not created")
            return

        try:
            logger.info(
                f"Started refreshing sandbox {self._sandbox.env_id} (id: {instance_id})"
            )

            current_retry = 0

            with E2BApiClient(api_key=self._api_key) as api_client:
                api = client.InstancesApi(api_client)
                while True:
                    if not self._is_open:
                        logger.debug(
                            f"Cannot refresh sandbox - it was closed. {self._sandbox.instance_id}"
                        )
                        return
                    sleep(SANDBOX_REFRESH_PERIOD)
                    try:
                        api.instances_instance_id_refreshes_post(
                            instance_id,
                            client.InstancesInstanceIDRefreshesPostRequest(duration=0),
                        )
                        logger.debug(f"Refreshed sandbox {instance_id}")
                    except exceptions.ApiException as e:
                        if e.status == 404:
                            raise SandboxException(
                                f"Sandbox {instance_id} failed because it cannot be found"
                            ) from e
                        else:
                            if current_retry < self._refresh_retries:
                                logger.error(
                                    f"Refreshing sandbox {instance_id} failed. Retrying..."
                                )
                                current_retry += 1
                            else:
                                logger.error(
                                    f"Refreshing sandbox {instance_id} failed. Max retries exceeded"
                                )
                                raise e
        finally:
            if self._sandbox:
                logger.info(f"Stopped refreshing sandbox (id: {instance_id})")
            else:
                logger.info("No sandbox to stop refreshing. Sandbox was not created")

            self._close()
