import logging
from typing import Dict, Optional, TypedDict, overload

import httpx
from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, ahandle_envd_api_exception
from e2b.exceptions import format_request_timeout_error
from e2b.sandbox.main import SandboxSetup
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_async.filesystem.filesystem import Filesystem
from e2b.sandbox_async.process.process import Process
from e2b.sandbox_async.process.pty import Pty
from e2b.sandbox_async.sandbox_api import SandboxApi
from typing_extensions import Unpack

logger = logging.getLogger(__name__)


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    async def handle_async_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = await super().handle_async_request(request)

        # data = connect.GzipCompressor.decompress(response.read()).decode()
        logger.info(f"Response: {response.status_code} {url}")

        return response


class AsyncSandboxOpts(TypedDict):
    sandbox_id: str
    connection_config: ConnectionConfig


class AsyncSandbox(SandboxSetup, SandboxApi):
    """
    E2B cloud sandbox gives your agent a full cloud development environment that's sandboxed.

    That means:
    - Access to Linux OS
    - Using filesystem (create, list, and delete files and dirs)
    - Run commands
    - Sandboxed - you can run any code
    - Access to the internet

    Check usage docs - https://e2b.dev/docs/sandbox/overview

    These cloud sandboxes are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.

    Use the `AsyncSandbox.create()` to create a new sandbox.

    Example:
    ```python
    sandbox = await AsyncSandbox.create()
    ```
    """

    @property
    def files(self) -> Filesystem:
        """
        Filesystem module for interacting with the sandbox's filesystem
        """
        return self._filesystem

    @property
    def commands(self) -> Process:
        """
        Commands module for interacting with the sandbox's processes
        """
        return self._process

    @property
    def pty(self) -> Pty:
        """
        PTY module for interacting with the sandbox's pseudo-terminal.
        """
        return self._pty

    @property
    def sandbox_id(self) -> str:
        """
        Get the sandbox ID
        """
        return self._sandbox_id

    @property
    def envd_api_url(self) -> str:
        """
        Get the sandbox API URL
        """
        return self._envd_api_url

    @property
    def connection_config(self) -> ConnectionConfig:
        """
        Get the ConnectionConfig object
        """
        return self._connection_config

    def __init__(self, **opts: Unpack[AsyncSandboxOpts]):
        """
        Use `Sandbox.create()` instead.
        """
        super().__init__()

        self._sandbox_id = opts["sandbox_id"]
        self._connection_config = opts["connection_config"]

        self._envd_api_url = f"{'http' if self.connection_config.debug else 'https'}://{self.get_host(self.envd_port)}"

        self._transport = AsyncTransportWithLogger(limits=self._limits)
        self._envd_api = httpx.AsyncClient(
            base_url=self.envd_api_url,
            transport=self._transport,
        )

        self._filesystem = Filesystem(
            self.envd_api_url,
            self.connection_config,
            self._transport._pool,
            self._envd_api,
        )
        self._process = Process(
            self.envd_api_url,
            self.connection_config,
            self._transport._pool,
        )
        self._pty = Pty(
            self.envd_api_url,
            self.connection_config,
            self._transport._pool,
        )

    async def is_running(self, request_timeout: Optional[float] = None) -> bool:
        """
        Check if the sandbox is running.

        :return: `True` if the sandbox is running, `False` otherwise

        Example
        ```python
        sandbox = await AsyncSandbox.create()
        await sandbox.is_running() # Returns True

        await sandbox.kill()
        await sandbox.is_running() # Returns False
        ```
        """
        try:
            r = await self._envd_api.get(
                ENVD_API_HEALTH_ROUTE,
                timeout=self.connection_config.get_request_timeout(request_timeout),
            )

            if r.status_code == 502:
                return False

            err = await ahandle_envd_api_exception(r)

            if err:
                raise err

        except httpx.TimeoutException:
            raise format_request_timeout_error()

        return True

    @classmethod
    async def create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ):
        """
        Creates a new sandbox.

        This method creates a new sandbox in the async version,
        you have to use this method instead of using the constructor.
        """
        connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        sandbox_id = (
            "debug_sandbox_id"
            if connection_config.debug
            else await SandboxApi._create_sandbox(
                template=template or cls.default_template,
                api_key=api_key,
                timeout=timeout or cls.default_sandbox_timeout,
                metadata=metadata,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
                env_vars=envs,
            )
        )

        return cls(
            sandbox_id=sandbox_id,
            connection_config=connection_config,
        )

    @classmethod
    async def connect(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ):
        """
        Connects to an existing Sandbox.
        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key
        :param domain: E2B Domain (use only if you self-host E2B)
        :param debug: For developing purposes, uses a local sandbox
        :return: Sandbox object

        @example
        ```python
        sandbox = await AsyncSandbox.create()
        sandbox_id = sandbox.sandbox_id

        # Another code block
        same_sandbox = await AsyncSandbox.connect(sandbox_id)
        """
        connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
        )

        return cls(
            sandbox_id=sandbox_id,
            connection_config=connection_config,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.kill()

    @overload
    async def kill(self, request_timeout: Optional[float] = None) -> bool:
        ...

    @overload
    @staticmethod
    async def kill(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        ...

    @class_method_variant("_cls_kill")
    async def kill(self, request_timeout: Optional[float] = None) -> bool:  # type: ignore
        """
        Kill the sandbox.

        :param request_timeout: Timeout for the request
        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        config_dict = self.connection_config.__dict__
        config_dict.pop("access_token", None)
        config_dict.pop("api_url", None)

        if request_timeout:
            config_dict["request_timeout"] = request_timeout

        await SandboxApi._cls_kill(
            sandbox_id=self.sandbox_id,
            **self.connection_config.__dict__,
        )

    @overload
    async def set_timeout(
        self,
        timeout: int,
        request_timeout: Optional[float] = None,
    ) -> None:
        ...

    @overload
    @staticmethod
    async def set_timeout(
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> None:
        ...

    @class_method_variant("_cls_set_timeout")
    async def set_timeout(  # type: ignore
        self,
        timeout: int,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Set the sandbox's timeout, after which the sandbox will be automatically killed.
        The sandbox can be kept alive for a maximum of 24 hours from the time of creation.
        If you try to set the timeout to a period, which exceeds the maximum limit, the timeout will be set to the maximum limit.

        :param timeout: Duration in milliseconds. Must be between 0 and 86400000 milliseconds (24 hours).
        :param request_timeout: Timeout for the request
        """
        config_dict = self.connection_config.__dict__
        config_dict.pop("access_token", None)
        config_dict.pop("api_url", None)

        if request_timeout:
            config_dict["request_timeout"] = request_timeout

        await SandboxApi._cls_set_timeout(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **self.connection_config.__dict__,
        )
