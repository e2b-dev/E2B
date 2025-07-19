from typing import Optional, overload, List, Dict
from packaging.version import Version

from e2b.exceptions import SandboxException, NotFoundException
from e2b.sandbox.utils import class_method_variant
from e2b.sandbox.sandbox_api import SandboxMetrics
from e2b.sandbox_async.main import AsyncSandbox
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.api import AsyncApiClient, handle_api_exception
from e2b.api.client.api.sandboxes import (
    get_sandboxes_sandbox_id_metrics,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
)
from e2b.api.client.models import (
    ResumedSandbox,
)
from e2b.api.client.models.error import Error


class AsyncSandboxBeta(AsyncSandbox):
    @classmethod
    async def resume(
        cls,
        sandbox_id: str,
        timeout: Optional[int] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ):
        """
        Resume the sandbox.

        The **default sandbox timeout of 300 seconds** will be used for the resumed sandbox.
        If you pass a custom timeout via the `timeout` parameter, it will be used instead.

        :param sandbox_id: sandbox ID
        :param timeout: Timeout for the sandbox in **seconds**
        :param api_key: E2B API Key to use for authentication
        :param domain: Domain of the sandbox server
        :param debug: Enable debug mode
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param proxy: Proxy to use for the request

        :return: A running sandbox instance
        """

        timeout = timeout or cls.default_sandbox_timeout

        await cls._cls_resume(
            sandbox_id=sandbox_id,
            request_timeout=request_timeout,
            timeout=timeout,
            api_key=api_key,
            domain=domain,
            debug=debug,
            proxy=proxy,
            headers=headers,
        )

        return await cls.connect(
            sandbox_id=sandbox_id,
            api_key=api_key,
            domain=domain,
            debug=debug,
            proxy=proxy,
            headers=headers,
        )

    @overload
    async def pause(  # type: ignore
        self,
        request_timeout: Optional[float] = None,
    ) -> str:
        """
        Pause the sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: sandbox ID that can be used to resume the sandbox
        """
        ...

    @overload
    @staticmethod
    async def pause(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> str:
        """
        Pause the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param proxy: Proxy to use for the request

        :return: sandbox ID that can be used to resume the sandbox
        """
        ...

    @class_method_variant("_cls_pause")
    async def pause(  # type: ignore
        self,
        request_timeout: Optional[float] = None,
    ) -> str:
        """
        Pause the sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: sandbox ID that can be used to resume the sandbox
        """

        await AsyncSandboxBeta._cls_pause(
            sandbox_id=self.sandbox_id,
            api_key=self.connection_config.api_key,
            domain=self.connection_config.domain,
            debug=self.connection_config.debug,
            request_timeout=request_timeout,
        )

        return self.sandbox_id

    @overload
    async def get_metrics(  # type: ignore
        self,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the current sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox metrics containing CPU and memory usage information
        """
        ...

    @overload
    @staticmethod
    async def get_metrics(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the sandbox specified by sandbox ID.

        :param sandbox_id: Sandbox ID
        :param api_key: E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param proxy: Proxy to use for the request

        :return: List of sandbox metrics containing CPU and memory usage information
        """
        ...

    @class_method_variant("_cls_get_metrics")
    async def get_metrics(  # type: ignore
        self,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxMetrics]:
        """
        Get the metrics of the current sandbox.

        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox metrics containing CPU and memory usage information
        """
        if self._envd_version and Version(self._envd_version) < Version("0.1.5"):
            raise SandboxException(
                "Metrics are not supported in this version of the sandbox, please rebuild your template."
            )

        return await AsyncSandboxBeta._cls_get_metrics(
            sandbox_id=self.sandbox_id,
            # TODO: Fix error
            **self.connection_config.get_api_params(request_timeout),
        )

    @classmethod
    async def _cls_get_metrics(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> List[SandboxMetrics]:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            proxy=proxy,
        )

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        async with AsyncApiClient(
            config,
            limits=cls._limits,
        ) as api_client:
            res = await get_sandboxes_sandbox_id_metrics.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            # Check if res.parse is Error
            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            return [SandboxMetrics._from_model(metric) for metric in res.parsed]

    @classmethod
    async def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            proxy=proxy,
        )

        async with AsyncApiClient(
            config,
            limits=cls._limits,
        ) as api_client:
            res = await post_sandboxes_sandbox_id_resume.asyncio_detailed(
                sandbox_id,
                client=api_client,
                body=ResumedSandbox(timeout=timeout),
            )

            if res.status_code == 404:
                raise NotFoundException(f"Paused sandbox {sandbox_id} not found")

            if res.status_code == 409:
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True

    @classmethod
    async def _cls_pause(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            proxy=proxy,
        )

        async with AsyncApiClient(
            config,
            limits=cls._limits,
        ) as api_client:
            res = await post_sandboxes_sandbox_id_pause.asyncio_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code == 404:
                raise NotFoundException(f"Sandbox {sandbox_id} not found")

            if res.status_code == 409:
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True
