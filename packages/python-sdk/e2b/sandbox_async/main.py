import logging
import httpx

from typing import Dict, Optional, TypedDict, overload
from typing_extensions import Unpack

from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, ahandle_envd_api_exception
from e2b.exceptions import format_request_timeout_error
from e2b.sandbox.main import SandboxSetup
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_async.filesystem.filesystem import Filesystem
from e2b.sandbox_async.commands.command import Commands
from e2b.sandbox_async.commands.pty import Pty
from e2b.sandbox_async.sandbox_api import SandboxApi

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
    E2B cloud sandbox is a secure and isolated cloud environment.

    The sandbox allows you to:
    - Access Linux OS
    - Create, list, and delete files and directories
    - Run commands
    - Run isolated code
    - Access the internet

    Check docs [here](https://e2b.dev/docs).

    Use the `AsyncSandbox.create()` to create a new sandbox.

    Example:
    ```python
    from e2b import AsyncSandbox

    sandbox = await AsyncSandbox.create()
    ```
    """

    @property
    def files(self) -> Filesystem:
        """
        Module for interacting with the sandbox filesystem.
        """
        return self._filesystem

    @property
    def commands(self) -> Commands:
        """
        Module for running commands in the sandbox.
        """
        return self._commands

    @property
    def pty(self) -> Pty:
        """
        Module for interacting with the sandbox pseudo-terminal.
        """
        return self._pty

    @property
    def sandbox_id(self) -> str:
        """
        Unique identifier of the sandbox.
        """
        return self._sandbox_id

    @property
    def envd_api_url(self) -> str:
        return self._envd_api_url

    @property
    def connection_config(self) -> ConnectionConfig:
        return self._connection_config

    def __init__(self, **opts: Unpack[AsyncSandboxOpts]):
        """
        Use `AsyncSandbox.create()` to create a new sandbox instead.
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
        self._commands = Commands(
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

        :param request_timeout: Timeout for the request in **seconds**

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
        Create a new sandbox.

        By default, the sandbox is created from the default `base` sandbox template.

        :param template: Sandbox template name or ID
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. Maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**

        :return: sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
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
        Connect to an existing sandbox.
        With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable

        :return: sandbox instance for the existing sandbox

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
        """
        Kill the sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
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
        """
        Kill the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        ...

    @class_method_variant("_cls_kill")
    async def kill(self, request_timeout: Optional[float] = None) -> bool:  # type: ignore
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
        """
        Set the timeout of the sandbox.
        After the timeout expires the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        Maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param timeout: Timeout for the sandbox in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        """
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
        """
        Set the timeout of the specified sandbox.
        After the timeout expires the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        Maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        """
        ...

    @class_method_variant("_cls_set_timeout")
    async def set_timeout(  # type: ignore
        self,
        timeout: int,
        request_timeout: Optional[float] = None,
    ) -> None:
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
