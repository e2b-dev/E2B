import datetime
import urllib.parse

from typing import Optional, Dict, List
from e2b.api.client.models.error import Error
from e2b.api.compatibility import modified_get_v2_sandboxes
from packaging.version import Version

from e2b.sandbox.sandbox_api import (
    SandboxInfo,
    SandboxQuery,
    SandboxPaginatorBase,
    SandboxMetrics,
)
from e2b.sandbox.main import SandboxBase
from e2b.exceptions import TemplateException, SandboxException
from e2b.api import ApiClient, SandboxCreateResponse
from e2b.api.client.models import (
    NewSandbox,
    PostSandboxesSandboxIDTimeoutBody,
    Error,
)
from e2b.api.client.api.sandboxes import (
    get_sandboxes_sandbox_id,
    post_sandboxes_sandbox_id_timeout,
    delete_sandboxes_sandbox_id,
    post_sandboxes,
    get_sandboxes_sandbox_id_metrics,
)
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.api import handle_api_exception
from e2b.api.client.types import UNSET


class SandboxPaginator(SandboxPaginatorBase):
    """
    Paginator for listing sandboxes.

    Example:
    ```python
    paginator = Sandbox.list()

    while paginator.has_next:
        sandboxes = paginator.next_items()
        print(sandboxes)
    ```
    """

    def next_items(self) -> List[SandboxInfo]:
        """
        Returns the next page of sandboxes.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :returns: List of sandboxes
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        # Convert filters to the format expected by the API
        metadata: Optional[str] = None
        if self.query and self.query.metadata:
            quoted_metadata = {
                urllib.parse.quote(k): urllib.parse.quote(v)
                for k, v in self.query.metadata.items()
            }
            metadata = urllib.parse.urlencode(quoted_metadata)

        with ApiClient(
            self._config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = modified_get_v2_sandboxes.sync_detailed(
                client=api_client,
                metadata=metadata if metadata else UNSET,
                state=self.query.state if self.query and self.query.state else UNSET,
                limit=self.limit if self.limit else UNSET,
                next_token=self._next_token if self._next_token else UNSET,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            self._next_token = res.headers.get("x-next-token")
            self._has_next = bool(self._next_token)

            if res.parsed is None:
                return []

            # Check if res.parse is Error
            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Cannot parse response")

            return [SandboxInfo._from_listed_sandbox(sandbox) for sandbox in res.parsed]


class SandboxApi(SandboxBase):
    @classmethod
    def list(
        cls,
        api_key: Optional[str] = None,
        query: Optional[SandboxQuery] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxPaginator:
        """
        List sandboxes with pagination.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param query: Filter the list of sandboxes by metadata or state, e.g. `SandboxListQuery(metadata={"key": "value"})` or `SandboxListQuery(state=["paused", "running"])`
        :param limit: Maximum number of sandboxes to return
        :param next_token: Token for pagination
        :param domain: Domain to use for the request, only relevant for self-hosted environments
        :param debug: Enable debug mode, all requested are then sent to localhost
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param proxy: Proxy to use for the request

        :returns: SandboxPaginator
        """
        return SandboxPaginator(
            query=query,
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            limit=limit,
            next_token=next_token,
            headers=headers,
            proxy=proxy,
        )

    @classmethod
    def _cls_get_info(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID
        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param domain: Domain to use for the request, defaults to `E2B_DOMAIN` environment variable
        :param debug: Debug mode, defaults to `E2B_DEBUG` environment variable
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param proxy: Proxy to use for the request

        :return: Sandbox info
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        with ApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = get_sandboxes_sandbox_id.sync_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            # Check if res.parse is Error
            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            return SandboxInfo._from_sandbox_detail(res.parsed)

    @classmethod
    def _cls_kill(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        with ApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = delete_sandboxes_sandbox_id.sync_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code == 404:
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True

    @classmethod
    def _cls_set_timeout(
        cls,
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> None:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        if config.debug:
            # Skip setting timeout in debug mode
            return

        with ApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = post_sandboxes_sandbox_id_timeout.sync_detailed(
                sandbox_id,
                client=api_client,
                body=PostSandboxesSandboxIDTimeoutBody(timeout=timeout),
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

    @classmethod
    def _create_sandbox(
        cls,
        template: str,
        timeout: int,
        metadata: Optional[Dict[str, str]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        secure: Optional[bool] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        with ApiClient(
            config,
            limits=SandboxBase._limits,
        ) as api_client:
            res = post_sandboxes.sync_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    secure=secure or False,
                ),
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            # Check if res.parse is Error
            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            if Version(res.parsed.envd_version) < Version("0.1.0"):
                SandboxApi._cls_kill(res.parsed.sandbox_id)
                raise TemplateException(
                    "You need to update the template to use the new SDK. "
                    "You can do this by running `e2b template build` in the directory with the template."
                )

            return SandboxCreateResponse._from_response(res.parsed)

    @classmethod
    def _cls_get_metrics(
        cls,
        sandbox_id: str,
        start: Optional[datetime.datetime] = None,
        end: Optional[datetime.datetime] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> List[SandboxMetrics]:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        if config.debug:
            # Skip getting the metrics in debug mode
            return []

        with ApiClient(
            config,
            limits=cls._limits,
        ) as api_client:
            res = get_sandboxes_sandbox_id_metrics.sync_detailed(
                sandbox_id,
                start=int(start.timestamp() * 1000) if start else None,
                end=int(end.timestamp() * 1000) if end else None,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            # Convert to typed SandboxMetrics objects
            return [
                SandboxMetrics(
                    cpu_count=metric.cpu_count,
                    cpu_used_pct=metric.cpu_used_pct,
                    disk_total=metric.disk_total,
                    disk_used=metric.disk_used,
                    mem_total=metric.mem_total,
                    mem_used=metric.mem_used,
                    timestamp=metric.timestamp,
                )
                for metric in res.parsed
            ]
