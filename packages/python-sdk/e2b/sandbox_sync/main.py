import datetime
import logging

import httpx

from typing import (
    Dict,
    Optional,
    overload,
    List,
    Type,
    TypedDict,
    Generic,
    TypeVar,
    ClassVar,
    Protocol,
    cast,
)

from packaging.version import Version
from typing_extensions import Unpack, deprecated

from e2b.api.client.types import Unset
from e2b.connection_config import ConnectionConfig, ApiParams
from e2b.envd.api import ENVD_API_HEALTH_ROUTE, handle_envd_api_exception
from e2b.exceptions import SandboxException, format_request_timeout_error
from e2b.sandbox.sandbox_api import SandboxMetrics
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from e2b.sandbox_sync.commands.command import Commands
from e2b.sandbox_sync.commands.pty import Pty
from e2b.sandbox_sync.sandbox_api import SandboxApi, SandboxInfo, SandboxApiBeta

logger = logging.getLogger(__name__)


class SandboxOpts(TypedDict):
    sandbox_id: str
    sandbox_domain: Optional[str]
    envd_version: Optional[str]
    envd_access_token: Optional[str]
    connection_config: ConnectionConfig


class TransportWithLogger(httpx.HTTPTransport):
    def handle_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = super().handle_request(request)

        # data = connect.GzipCompressor.decompress(response.read()).decode()
        logger.info(f"Response: {response.status_code} {url}")

        return response

    @property
    def pool(self):
        return self._pool


S = TypeVar("S", bound="Sandbox")


class BetaProto(Protocol[S]):
    @classmethod
    def create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: Optional[bool] = None,
        allow_internet_access: Optional[bool] = True,
        **opts: Unpack[ApiParams],
    ) -> S: ...

    @overload
    def resume(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        :return: A running sandbox instance
        """
        ...

    @overload
    @staticmethod
    def resume(
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """
        ...


class _Beta(Generic[S], SandboxApiBeta):

    sbx_class: ClassVar[type]
    """Class type"""

    def __init__(self, sbx_cls: S, sandbox_id: str):
        self._instance_cls: S = sbx_cls
        self._sandbox_id = sandbox_id

    @classmethod
    def create(
        cls,
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: Optional[bool] = None,
        allow_internet_access: Optional[bool] = True,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Create a new sandbox.

        By default, the sandbox is created from the default `base` sandbox template.

        :param template: Sandbox template name or ID
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param secure: Envd is secured with access token and cannot be used without it
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`.

        :return: A Sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """

        sbx = cast(Type[S], cls.sbx_class)
        return sbx.create(
            template, timeout, metadata, envs, secure, allow_internet_access, **opts
        )

    @overload
    def pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox.

        :return: Sandbox ID that can be used to resume the sandbox
        """
        ...

    @overload
    @staticmethod
    def pause(
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID

        :return: Sandbox ID that can be used to resume the sandbox
        """
        ...

    @class_method_variant("_api_pause")
    def pause(
        self,
        **opts: Unpack[ApiParams],
    ) -> str:
        """
        Pause the sandbox.

        :return: Sandbox ID that can be used to resume the sandbox
        """

        return self._api_pause(
            sandbox_id=self._sandbox_id,
            **opts,
        )

    @overload
    def resume(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        :return: A running sandbox instance
        """
        ...

    @overload
    @staticmethod
    def resume(
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """
        ...

    @class_method_variant("_cls_resume")
    def resume(
        self,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        The **default sandbox timeout of 300 seconds** will be used for the resumed sandbox.
        If you pass a custom timeout via the `timeout` parameter, it will be used instead.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """

        sbx = cast(Type[S], self._instance_cls)
        self._api_resume(
            sandbox_id=self._sandbox_id,
            timeout=timeout,
            **opts,
        )

        return sbx.connect(
            sandbox_id=self._sandbox_id,
            **opts,
        )

    @classmethod
    def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Resume the sandbox.

        The **default sandbox timeout of 300 seconds** will be used for the resumed sandbox.
        If you pass a custom timeout via the `timeout` parameter, it will be used instead.

        :param sandbox_id: Sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**

        :return: A running sandbox instance
        """

        cls._api_resume(
            sandbox_id=sandbox_id,
            timeout=timeout,
            **opts,
        )

        sbx = cast(Type[S], cls.sbx_class)
        return sbx.connect(
            sandbox_id=sandbox_id,
            **opts,
        )


class BetaDescriptor(Generic[S]):
    def __get__(self, obj, owner: Type[S]) -> Type[BetaProto[S]]:
        dyn = type(f"_BetaFor{owner.__name__}", (_Beta,), {"sbx_class": owner})
        return cast(Type[BetaProto[S]], dyn)


class _SandboxMeta(type):
    beta: BetaDescriptor


class Sandbox(SandboxApi, metaclass=_SandboxMeta):
    beta = BetaDescriptor()

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

    @deprecated("Use Sandbox.create() instead.")
    def __init__(self, **opts: Unpack[SandboxOpts]):
        """
        Use `Sandbox.create()` to create a new sandbox instead.
        """
        super().__init__(**opts)

        self._transport = TransportWithLogger(
            limits=self._limits, proxy=self.connection_config.proxy
        )
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
        )
        self._pty = Pty(
            self.envd_api_url,
            self.connection_config,
            self._transport.pool,
        )
        self.beta = _Beta(self, self.sandbox_id)

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
        cls: Type[S],
        template: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        envs: Optional[Dict[str, str]] = None,
        secure: Optional[bool] = None,
        allow_internet_access: Optional[bool] = True,
        **opts: Unpack[ApiParams],
    ) -> S:
        """
        Create a new sandbox.

        By default, the sandbox is created from the default `base` sandbox template.

        :param template: Sandbox template name or ID
        :param timeout: Timeout for the sandbox in **seconds**, default to 300 seconds. The maximum time a sandbox can be kept alive is 24 hours (86_400 seconds) for Pro users and 1 hour (3_600 seconds) for Hobby users.
        :param metadata: Custom metadata for the sandbox
        :param envs: Custom environment variables for the sandbox
        :param secure: Envd is secured with access token and cannot be used without it
        :param allow_internet_access: Allow sandbox to access the internet, defaults to `True`.

        :return: A Sandbox instance for the new sandbox

        Use this method instead of using the constructor to create a new sandbox.
        """

        extra_sandbox_headers = {}

        debug = opts.get("debug")
        if debug:
            sandbox_id = "debug_sandbox_id"
            sandbox_domain = None
            envd_version = None
            envd_access_token = None
        else:
            response = cls._create_sandbox(
                template=template or cls.default_template,
                timeout=timeout or cls.default_sandbox_timeout,
                metadata=metadata,
                env_vars=envs,
                secure=secure,
                allow_internet_access=allow_internet_access,
                **opts,
            )

            sandbox_id = response.sandbox_id
            sandbox_domain = response.sandbox_domain
            envd_version = response.envd_version
            envd_access_token = response.envd_access_token

            if envd_access_token is not None and not isinstance(
                envd_access_token, Unset
            ):
                extra_sandbox_headers["X-Access-Token"] = envd_access_token

        connection_config = ConnectionConfig(
            extra_sandbox_headers=extra_sandbox_headers,
            **opts,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=sandbox_domain,
            envd_version=envd_version,
            envd_access_token=envd_access_token,
            connection_config=connection_config,
        )

    @classmethod
    def connect(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ):
        """
        Connect to an existing sandbox.
        With a sandbox ID, you can connect to the same sandbox from different places or environments (serverless functions, etc.).

        :param sandbox_id: Sandbox ID

        @example
        ```python
        sandbox = Sandbox.create()
        sandbox_id = sandbox.sandbox_id

        # Another code block
        same_sandbox = Sandbox.connect(sandbox_id)
        ```
        """
        response = cls._cls_get_info(sandbox_id, **opts)

        sandbox_headers = {}
        envd_access_token = response._envd_access_token
        if envd_access_token is not None and not isinstance(envd_access_token, Unset):
            sandbox_headers["X-Access-Token"] = envd_access_token

        connection_config = ConnectionConfig(
            extra_sandbox_headers=sandbox_headers,
            **opts,
        )

        return cls(
            sandbox_id=sandbox_id,
            sandbox_domain=response.sandbox_domain,
            connection_config=connection_config,
            envd_version=response.envd_version,
            envd_access_token=envd_access_token,
        )

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
        return self._cls_kill(
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

        self._cls_set_timeout(
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
        return self._cls_get_info(
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
        if self._envd_version:
            if Version(self._envd_version) < Version("0.1.5"):
                raise SandboxException(
                    "Metrics are not supported in this version of the sandbox, please rebuild your template."
                )

            if Version(self._envd_version) < Version("0.2.4"):
                logger.warning(
                    "Disk metrics are not supported in this version of the sandbox, please rebuild the template to get disk metrics."
                )

        return self._cls_get_metrics(
            sandbox_id=self.sandbox_id,
            start=start,
            end=end,
            **self.connection_config.get_api_params(**opts),
        )
