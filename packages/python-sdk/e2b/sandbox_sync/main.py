import logging
from typing import Dict, Optional, overload

import httpx
from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, handle_envd_api_exception
from e2b.exceptions import SandboxException, format_request_timeout_error
from e2b.sandbox.main import SandboxSetup
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from e2b.sandbox_sync.process.process import Process
from e2b.sandbox_sync.process.pty import Pty
from e2b.sandbox_sync.sandbox_api import SandboxApi

logger = logging.getLogger(__name__)


class TransportWithLogger(httpx.HTTPTransport):
    def handle_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = super().handle_request(request)

        # data = connect.GzipCompressor.decompress(response.read()).decode()
        logger.info(f"Response: {response.status_code} {url}")

        return response


class Sandbox(SandboxSetup, SandboxApi):
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

    Use the `Sandbox()` to create a new sandbox.

    Example:
    ```python
    sandbox = Sandbox()
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
        PTY module for interacting with the sandbox's pseudo-terminal
        """
        return self._pty

    @property
    def sandbox_id(self) -> str:
        """
        Unique identifier of the sandbox
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

    def __init__(
        self,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        sandbox_id: Optional[str] = None,
        request_timeout: Optional[float] = None,
    ):
        """Instantiate sandbox"""
        super().__init__()

        if sandbox_id and (metadata is not None or template is not None):
            raise SandboxException(
                "Cannot set metadata or timeout when connecting to an existing sandbox. "
                "Use Sandbox.connect method instead.",
            )

        self._connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if self.connection_config.debug:
            self._sandbox_id = "debug_sandbox_id"
        elif sandbox_id is not None:
            self._sandbox_id = sandbox_id
        else:
            template = template or self.default_template
            timeout = timeout or self.default_sandbox_timeout
            self._sandbox_id = SandboxApi._create_sandbox(
                template=template,
                api_key=api_key,
                timeout=timeout,
                metadata=metadata,
                env_vars=envs,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
            )

        self._envd_api_url = f"{'http' if self.connection_config.debug else 'https'}://{self.get_host(self.envd_port)}"

        self._transport = TransportWithLogger(limits=self._limits)
        self._envd_api = httpx.Client(
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

    def is_running(self, request_timeout: Optional[float] = None) -> bool:
        """
        Check if the sandbox is running.

        :return: `True` if the sandbox is running, `False` otherwise

        Example
        ```python
        sandbox = Sandbox()
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
    def connect(
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
        sandbox = Sandbox()
        sandbox_id = sandbox.sandbox_id

        # Another code block
        same_sandbox = Sandbox.connect(sandbox_id)
        """
        return cls(
            sandbox_id=sandbox_id,
            api_key=api_key,
            domain=domain,
            debug=debug,
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.kill()

    @overload
    def kill(self, request_timeout: Optional[float] = None) -> bool: ...

    @overload
    @staticmethod
    def kill(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool: ...

    @class_method_variant("_cls_kill")
    def kill(self, request_timeout: Optional[float] = None) -> bool:  # type: ignore
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

        SandboxApi._cls_kill(
            sandbox_id=self.sandbox_id,
            **self.connection_config.__dict__,
        )

    @overload
    def set_timeout(
        self,
        timeout: int,
        request_timeout: Optional[float] = None,
    ) -> None: ...
    @overload
    @staticmethod
    def set_timeout(
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> None: ...
    @class_method_variant("_cls_set_timeout")
    def set_timeout(  # type: ignore
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

        SandboxApi._cls_set_timeout(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **self.connection_config.__dict__,
        )
