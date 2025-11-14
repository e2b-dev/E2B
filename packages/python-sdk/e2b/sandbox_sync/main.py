import datetime
import json
import logging
import uuid
from typing import Dict, List, Optional, overload

import httpx
from packaging.version import Version
from typing_extensions import Self, Unpack

from e2b.api.client.types import Unset
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, handle_envd_api_exception
from e2b.envd.versions import ENVD_DEBUG_FALLBACK
from e2b.exceptions import SandboxException, format_request_timeout_error
from e2b.sandbox.main import SandboxOpts
from e2b.sandbox.sandbox_api import McpServer, SandboxMetrics, SandboxNetworkOpts
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_sync.commands.command import Commands
from e2b.sandbox_sync.commands.pty import Pty
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from e2b.sandbox_sync.sandbox_api import SandboxApi, SandboxInfo
from e2b.api.client_sync import get_transport

logger = logging.getLogger(__name__)


class Sandbox(SandboxApi):
    """
    E2B cloud sandbox is a secure and isolated cloud environment.

    The sandbox allows you to:
    - Access Linux OS
    - Create, list, and delete files and directories
    - Run commands
    - Run isolated code
    - Access the internet

    Check docs [here](https://e2b.dev/docs).

    Use the `Sandbox.create()` to create a new sandbox.

    Example:
    ```python
    from e2b import Sandbox

    sandbox = Sandbox.create()
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

    def __init__(self, **opts: Unpack[SandboxOpts]):
        """
        :deprecated: This constructor is deprecated

        Use `Sandbox.create()` to create a new sandbox instead.
        """
        super().__init__(**opts)

        self._transport = get_transport(self.connection_config)

        self._envd_api = httpx.Client(
            base_url=self.envd_api_url,
            transport=self._transport,
            headers=self.connection_config.sandbox_headers,
        )
        self._filesystem = Filesystem(
            self.envd_api_url,
            self._envd_version,
            self.connection_config,
            self._transport.pool,
            self._envd_api,
        )
        self._commands = Commands(
            self.envd_api_url,
            self.connection_config,
            self._transport.pool,
            self._envd_version,
        )
        self._pty = Pty(
            self.envd_api_url,
            self.connection_config,
            self._transport.pool,
            self._envd_version,
        )

    def is_running(self, request_timeout: Optional[float] = None) -> bool:
        """
        Check if the sandbox is running.

        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the sandbox is running, `False` otherwise

        Example
        ```python
        sandbox = Sandbox.create()
        sandbox.is_running() # Returns True

        sandbox.kill()
        sandbox.is_running() # Returns False
        ```
        """
        try:
            r = self._envd_api.get(
                ENVD_API_HEALTH_ROUTE,
                timeout=self.connection_config.get_request_timeout(request_timeout),
            )

            if r.status_code == 502:
                return False

            err = handle_envd_api_exception(r)

            if err:
                raise err

        except httpx.TimeoutException:
            raise format_request_timeout_error()

        return True

    @classmethod
    def create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: bool = True,
        allow_internet_access: bool = True,
        mcp: Optional[McpServer] = None,
        network: Optional[SandboxNetworkOpts] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        Create a new sandbox.

        By default, the sandbox is created from the default `base` sandbox template.

        :param template: Sandbox template name or ID
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param secure: Envd is secured with access token and cannot be used without it, defaults to `True`.
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`. If set to `False`, it works the same as setting network `deny_out` to `[0.0.0.0/0]`.
        :param mcp: MCP server to enable in the sandbox
        :param network: Sandbox network configuration

        :return: A Sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """
        if not template and mcp is not None:
            template = cls.default_mcp_template
        elif not template:
            template = cls.default_template

        sandbox = cls._create(
            template=template,
            auto_pause=False,
            timeout=timeout,
            metadata=metadata,
            envs=envs,
            secure=secure,
            allow_internet_access=allow_internet_access,
            mcp=mcp,
            network=network,
            **opts,
        )

        if mcp is not None:
            token = str(uuid.uuid4())
            sandbox._mcp_token = token

            res = sandbox.commands.run(
                f"mcp-gateway --config '{json.dumps(mcp)}'",
                user="root",
                envs={"GATEWAY_ACCESS_TOKEN": token},
            )
            if res.exit_code != 0:
                raise Exception(f"Failed to start MCP gateway: {res.stderr}")

        return sandbox

    @overload
    def connect(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
        Sandbox must be either running or be paused.

        With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).

        :param timeout: Timeout for the sandbox in **seconds**
            For running sandboxes, the timeout will update only if the new timeout is longer than the existing one.
        :return: A running sandbox instance

        @example
        ```python
        sandbox = Sandbox.create()
        sandbox.beta_pause()

        # Another code block
        same_sandbox = sandbox.connect()

        :return: A running sandbox instance
        """
        ...

    @overload
    @classmethod
    def connect(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
        Sandbox must be either running or be paused.

        With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**.
            For running sandboxes, the timeout will update only if the new timeout is longer than the existing one.
        :return: A running sandbox instance

        @example
        ```python
        sandbox = Sandbox.create()
        Sandbox.beta_pause(sandbox.sandbox_id)

        # Another code block
        same_sandbox = Sandbox.connect(sandbox.sandbox_id)
        ```
        """
        ...

    @class_method_variant("_cls_connect")
    def connect(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        Connect to a sandbox. If the sandbox is paused, it will be automatically resumed.
        Sandbox must be either running or be paused.

        With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).

        :param timeout: Timeout for the sandbox in **seconds**.
            For running sandboxes, the timeout will update only if the new timeout is longer than the existing one.
        :return: A running sandbox instance

        @example
        ```python
        sandbox = Sandbox.create()
        sandbox.beta_pause()

        # Another code block
        same_sandbox = sandbox.connect()
        ```
        """
        SandboxApi._cls_connect(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **opts,
        )

        return self

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.kill()

    @overload
    def kill(
        self,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Kill the sandbox.

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        ...

    @overload
    @staticmethod
    def kill(
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Kill the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        ...

    @class_method_variant("_cls_kill")
    def kill(
        self,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Kill the sandbox specified by sandbox ID.

        :return: `True` if the sandbox was killed, `False` if the sandbox was not found
        """
        return SandboxApi._cls_kill(
            sandbox_id=self.sandbox_id,
            **self.connection_config.get_api_params(**opts),
        )

    @overload
    def set_timeout(
        self,
        timeout: int,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Set the timeout of the sandbox.
        After the timeout expires, the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param timeout: Timeout for the sandbox in **seconds**
        """
        ...

    @overload
    @staticmethod
    def set_timeout(
        sandbox_id: str,
        timeout: int,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Set the timeout of the sandbox specified by sandbox ID.
        After the timeout expires, the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**
        """
        ...

    @class_method_variant("_cls_set_timeout")
    def set_timeout(
        self,
        timeout: int,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Set the timeout of the sandbox.
        After the timeout expires, the sandbox will be automatically killed.
        This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.set_timeout`.

        The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.

        :param timeout: Timeout for the sandbox in **seconds**

        """

        SandboxApi._cls_set_timeout(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **self.connection_config.get_api_params(**opts),
        )

    @overload
    def get_info(
        self,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.

        :return: Sandbox info
        """
        ...

    @overload
    @staticmethod
    def get_info(
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.

        :param sandbox_id: Sandbox ID

        :return: Sandbox info
        """
        ...

    @class_method_variant("_cls_get_info")
    def get_info(
        self,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get sandbox information like sandbox ID, template, metadata, started at/end at date.

        :return: Sandbox info
        """
        return SandboxApi._cls_get_info(
            sandbox_id=self.sandbox_id,
            **self.connection_config.get_api_params(**opts),
        )

    @overload
    def get_metrics(
        self,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the current sandbox.

        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to the current time

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        ...

    @overload
    @staticmethod
    def get_metrics(
        sandbox_id: str,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to the current time

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        ...

    @class_method_variant("_cls_get_metrics")
    def get_metrics(
        self,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the sandbox specified by sandbox ID.

        :param start: Start time for the metrics, defaults to the start of the sandbox
        :param end: End time for the metrics, defaults to the current time

        :return: List of sandbox metrics containing CPU, memory and disk usage information
        """
        if self._envd_version < Version("0.1.5"):
            raise SandboxException(
                "Metrics are not supported in this version of the sandbox, please rebuild your template."
            )

        if self._envd_version < Version("0.2.4"):
            logger.warning(
                "Disk metrics are not supported in this version of the sandbox, please rebuild the template to get disk metrics."
            )

        return SandboxApi._cls_get_metrics(
            sandbox_id=self.sandbox_id,
            start=start,
            end=end,
            **self.connection_config.get_api_params(**opts),
        )

    @classmethod
    def beta_create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        auto_pause: bool = False,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: bool = True,
        allow_internet_access: bool = True,
        mcp: Optional[McpServer] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        """
        [BETA] This feature is in beta and may change in the future.

        Create a new sandbox.

        By default, the sandbox is created from the default `base` sandbox template.

        :param template: Sandbox template name or ID
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param auto_pause: Automatically pause the sandbox after the timeout expires. Defaults to `False`.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param secure: Envd is secured with access token and cannot be used without it, defaults to `True`.
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`.
        :param mcp: MCP server to enable in the sandbox

        :return: A Sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """

        if not template and mcp is not None:
            template = cls.default_mcp_template
        elif not template:
            template = cls.default_template

        sandbox = cls._create(
            template=template,
            auto_pause=auto_pause,
            timeout=timeout,
            metadata=metadata,
            envs=envs,
            secure=secure,
            allow_internet_access=allow_internet_access,
            mcp=mcp,
            **opts,
        )

        if mcp is not None:
            token = str(uuid.uuid4())
            sandbox._mcp_token = token

            res = sandbox.commands.run(
                f"mcp-gateway --config '{json.dumps(mcp)}'",
                user="root",
                envs={"GATEWAY_ACCESS_TOKEN": token},
            )
            if res.exit_code != 0:
                raise Exception(f"Failed to start MCP gateway: {res.stderr}")

        return sandbox

    @overload
    def beta_pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        [BETA] This feature is in beta and may change in the future.

        Pause the sandbox.
        """
        ...

    @overload
    @classmethod
    def beta_pause(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        [BETA] This feature is in beta and may change in the future.

        Pause the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        """
        ...

    @class_method_variant("_cls_pause")
    def beta_pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        [BETA] This feature is in beta and may change in the future.

        Pause the sandbox.

        :return: Sandbox ID that can be used to resume the sandbox
        """

        SandboxApi._cls_pause(
            sandbox_id=self.sandbox_id,
            **opts,
        )

    def get_mcp_token(self) -> Optional[str]:
        """
        Get the MCP token for the sandbox.

        :return: MCP token for the sandbox, or None if MCP is not enabled.
        """
        if not self._mcp_token:
            self._mcp_token = self.files.read("/etc/mcp-gateway/.token", user="root")
        return self._mcp_token

    @classmethod
    def _cls_connect(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        sandbox = SandboxApi._cls_connect(sandbox_id, timeout, **opts)

        sandbox_headers = {}
        envd_access_token = sandbox.envd_access_token
        if envd_access_token is not None and not isinstance(envd_access_token, Unset):
            sandbox_headers["X-Access-Token"] = envd_access_token

        connection_config = ConnectionConfig(
            extra_sandbox_headers=sandbox_headers,
            **opts,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=sandbox.domain,
            connection_config=connection_config,
            envd_version=Version(sandbox.envd_version),
            envd_access_token=envd_access_token,
            traffic_access_token=sandbox.traffic_access_token,
        )

    @classmethod
    def _create(
        cls,
        template: Optional[str],
        timeout: Optional[int],
        auto_pause: bool,
        metadata: Optional[Dict[str, str]],
        envs: Optional[Dict[str, str]],
        secure: bool,
        allow_internet_access: bool,
        mcp: Optional[McpServer] = None,
        network: Optional[SandboxNetworkOpts] = None,
        **opts: Unpack[ApiParams],
    ) -> Self:
        extra_sandbox_headers = {}

        debug = opts.get("debug")
        if debug:
            sandbox_id = "debug_sandbox_id"
            sandbox_domain = None
            envd_version = ENVD_DEBUG_FALLBACK
            envd_access_token = None
            traffic_access_token = None
        else:
            response = SandboxApi._create_sandbox(
                template=template or cls.default_template,
                timeout=timeout or cls.default_sandbox_timeout,
                auto_pause=auto_pause,
                metadata=metadata,
                env_vars=envs,
                secure=secure,
                allow_internet_access=allow_internet_access,
                mcp=mcp,
                network=network,
                **opts,
            )

            sandbox_id = response.sandbox_id
            sandbox_domain = response.sandbox_domain
            envd_version = Version(response.envd_version)
            envd_access_token = response.envd_access_token
            traffic_access_token = response.traffic_access_token

            if envd_access_token is not None and not isinstance(
                envd_access_token, Unset
            ):
                extra_sandbox_headers["X-Access-Token"] = envd_access_token

        extra_sandbox_headers["E2b-Sandbox-Id"] = sandbox_id
        extra_sandbox_headers["E2b-Sandbox-Port"] = str(ConnectionConfig.envd_port)

        connection_config = ConnectionConfig(
            extra_sandbox_headers=extra_sandbox_headers,
            **opts,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=sandbox_domain,
            envd_version=envd_version,
            envd_access_token=envd_access_token,
            traffic_access_token=traffic_access_token,
            connection_config=connection_config,
        )
