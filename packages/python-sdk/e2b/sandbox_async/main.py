import datetime
import logging
import httpx

from typing import Dict, Optional, TypedDict, overload, List

from packaging.version import Version
from typing_extensions import Unpack

from e2b.api.client.types import Unset
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, ahandle_envd_api_exception
from e2b.exceptions import format_request_timeout_error, SandboxException
from e2b.sandbox.main import SandboxSetup
from e2b.sandbox.sandbox_api import SandboxMetrics
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_async.filesystem.filesystem import Filesystem
from e2b.sandbox_async.commands.command import Commands
from e2b.sandbox_async.commands.pty import Pty
from e2b.sandbox_async.sandbox_api import SandboxApi, SandboxInfo

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
    sandbox_domain: Optional[str]
    envd_version: Optional[str]
    envd_access_token: Optional[str]
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
    def sandbox_domain(self) -> str:
        """
        Unique identifier of the sandbox.
        """
        return self._sandbox_domain

    @property
    def envd_api_url(self) -> str:
        return self._envd_api_url

    @property
    def _envd_access_token(self) -> str:
        """Private property to access the envd token"""
        return self.__envd_access_token

    @_envd_access_token.setter
    def _envd_access_token(self, value: str):
        """Private setter for envd token"""
        self.__envd_access_token = value

    @property
    def connection_config(self) -> ConnectionConfig:
        return self._connection_config

    def __init__(self, **opts: Unpack[AsyncSandboxOpts]):
        """
        Use `AsyncSandbox.create()` to create a new sandbox instead.
        """
        super().__init__()

        self._connection_config = opts["connection_config"]

        self._sandbox_id = opts["sandbox_id"]
        self._sandbox_domain = opts["sandbox_domain"] or self.connection_config.domain

        self._envd_api_url = f"{'http' if self.connection_config.debug else 'https'}://{self.get_host(self.envd_port)}"
        self._envd_version = opts["envd_version"]
        self._envd_access_token = opts["envd_access_token"]

        self._transport = AsyncTransportWithLogger(
            limits=self._limits, proxy=self._connection_config.proxy
        )
        self._envd_api = httpx.AsyncClient(
            base_url=self.envd_api_url,
            transport=self._transport,
            headers=self._connection_config.headers,
        )

        self._filesystem = Filesystem(
            self.envd_api_url,
            self._envd_version,
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
        proxy: Optional[ProxyTypes] = None,
        secure: Optional[bool] = None,
        allow_internet_access: Optional[bool] = True,
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
        :param proxy: Proxy to use for the request and for the **requests made to the returned sandbox**
        :param secure: Envd is secured with access token and cannot be used without it
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`.

        :return: sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """

        connection_headers = {}

        if debug:
            sandbox_id = "debug_sandbox_id"
            sandbox_domain = None
            envd_version = None
            envd_access_token = None
        else:
            response = await SandboxApi._create_sandbox(
                template=template or cls.default_template,
                api_key=api_key,
                timeout=timeout or cls.default_sandbox_timeout,
                metadata=metadata,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
                env_vars=envs,
                secure=secure,
                proxy=proxy,
                allow_internet_access=allow_internet_access,
            )

            sandbox_id = response.sandbox_id
            sandbox_domain = response.sandbox_domain
            envd_version = response.envd_version
            envd_access_token = response.envd_access_token

            if envd_access_token is not None and not isinstance(
                envd_access_token, Unset
            ):
                connection_headers["X-Access-Token"] = envd_access_token

        connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=connection_headers,
            proxy=proxy,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=sandbox_domain,
            envd_version=envd_version,
            envd_access_token=envd_access_token,
            connection_config=connection_config,
        )

    @classmethod
    async def connect(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        proxy: Optional[ProxyTypes] = None,
    ):
        """
        Connect to an existing sandbox.
        With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param proxy: Proxy to use for the request and for the **requests made to the returned sandbox**

        :return: sandbox instance for the existing sandbox

        @example
        ```python
        sandbox = await AsyncSandbox.create()
        sandbox_id = sandbox.sandbox_id

        # Another code block
        same_sandbox = await AsyncSandbox.connect(sandbox_id)
        """

        connection_headers = {}

        response = await SandboxApi._cls_get_info(
            sandbox_id,
            api_key=api_key,
            domain=domain,
            debug=debug,
            proxy=proxy,
        )

        if response._envd_access_token is not None and not isinstance(
            response._envd_access_token, Unset
        ):
            connection_headers["X-Access-Token"] = response._envd_access_token

        connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            headers=connection_headers,
            proxy=proxy,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=response.sandbox_domain,
            connection_config=connection_config,
            envd_version=response.envd_version,
            envd_access_token=response._envd_access_token,
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
        proxy: Optional[ProxyTypes] = None,
    ) -> bool:
        """
        Kill the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param proxy: Proxy to use for the request

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        ...

    @class_method_variant("_cls_kill")
    async def kill(
        self,
        request_timeout: Optional[float] = None,
    ) -> bool:  # type: ignore
        config_dict = self.connection_config.__dict__
        config_dict.pop("access_token", None)
        config_dict.pop("api_url", None)

        if request_timeout:
            config_dict["request_timeout"] = request_timeout

        await SandboxApi._cls_kill(
            sandbox_id=self.sandbox_id,
            **config_dict,
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
        proxy: Optional[ProxyTypes] = None,
    ) -> None:
        """
        Set the timeout of the specified sandbox.
        After the timeout expires the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        Maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**
        :param request_timeout: Timeout for the request in **seconds**
        :param proxy: Proxy to use for the request
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
            **config_dict,
        )

    @overload
    async def get_info(
        self,
        request_timeout: Optional[float] = None,
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.
        :param request_timeout: Timeout for the request in **seconds**
        :return: Sandbox info
        """
        ...

    @overload
    @staticmethod
    async def get_info(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.
        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param domain: E2B domain to use for authentication, defaults to `E2B_DOMAIN` environment variable
        :param debug: Whether to use debug mode, defaults to `E2B_DEBUG` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Custom headers to use for the request
        :param proxy: Proxy to use for the request
        :return: Sandbox info
        """
        ...

    @class_method_variant("_cls_get_info")
    async def get_info(  # type: ignore
        self,
        request_timeout: Optional[float] = None,
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.
        :param request_timeout: Timeout for the request in **seconds**
        :return: Sandbox info
        """

        config_dict = self.connection_config.__dict__
        config_dict.pop("access_token", None)
        config_dict.pop("api_url", None)

        if request_timeout:
            config_dict["request_timeout"] = request_timeout

        return await SandboxApi._cls_get_info(
            sandbox_id=self.sandbox_id,
            **config_dict,
        )

    @overload
    async def get_metrics(  # type: ignore
        self,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the current sandbox.

        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to current time
        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        ...

    @overload
    @staticmethod
    async def get_metrics(
        sandbox_id: str,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to current time
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        ...

    @class_method_variant("_cls_get_metrics")
    async def get_metrics(  # type: ignore
        self,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the current sandbox.

        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to current time
        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        if self._envd_version:
            if Version(self._envd_version) < Version("0.1.5"):
                raise SandboxException(
                    "Metrics are not supported in this version of the sandbox, please rebuild your template."
                )

            if Version(self._envd_version) < Version("0.2.4"):
                logger.warning(
                    "Disk metrics are not supported in this version of the sandbox, please rebuild the template to get disk metrics."
                )

        config_dict = self.connection_config.__dict__
        config_dict.pop("access_token", None)
        config_dict.pop("api_url", None)
        if request_timeout:
            config_dict["request_timeout"] = request_timeout

        return await self._cls_get_metrics(
            sandbox_id=self.sandbox_id,
            start=start,
            end=end,
            **config_dict,
        )
