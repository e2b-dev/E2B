import logging
import httpx

from typing import Optional, Dict, overload

from e2b.sandbox.utils import class_method_variant
from e2b.connection_config import ConnectionConfig
from e2b.envd.api import (
    handle_envd_api_exception,
    ENVD_API_HEALTH_ROUTE,
)
from e2b.exceptions import SandboxException, format_request_timeout_error
from e2b.sandbox.main import SandboxSetup
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from e2b.sandbox_sync.process.main import Process
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
    @property
    def files(self) -> Filesystem:
        return self._filesystem

    @property
    def commands(self) -> Process:
        return self._process

    @property
    def sandbox_id(self) -> str:
        return self._sandbox_id

    @property
    def connection_config(self) -> ConnectionConfig:
        return self._connection_config

    @property
    def envd_api_url(self) -> str:
        return self._envd_api_url

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

    def is_running(self, request_timeout: Optional[float] = None) -> bool:
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
