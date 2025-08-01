import datetime
import urllib.parse

from typing import Optional, Dict, List
from packaging.version import Version

from e2b.sandbox.sandbox_api import (
    SandboxInfo,
    SandboxApiBase,
    SandboxQuery,
    ListedSandbox,
    SandboxMetrics,
)
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
    get_sandboxes,
    delete_sandboxes_sandbox_id,
    post_sandboxes,
    get_sandboxes_sandbox_id_metrics,
)
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.api import handle_api_exception


class SandboxApi(SandboxApiBase):
    @classmethod
    def list(
        cls,
        api_key: Optional[str] = None,
        query: Optional[SandboxQuery] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ) -> List[ListedSandbox]:
        """
        List all running sandboxes.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param query: Filter the list of sandboxes, e.g. by metadata `SandboxQuery(metadata={"key": "value"})`, if there are multiple filters they are combined with AND.
        :param domain: Domain to use for the request, only relevant for self-hosted environments
        :param debug: Enable debug mode, all requested are then sent to localhost
        :param request_timeout: Timeout for the request in **seconds**
        :param headers: Additional headers to send with the request
        :param proxy: Proxy to use for the request

        :return: List of running sandboxes
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        # Convert filters to the format expected by the API
        metadata = None
        if query:
            if query.metadata:
                quoted_metadata = {
                    urllib.parse.quote(k): urllib.parse.quote(v)
                    for k, v in query.metadata.items()
                }
                metadata = urllib.parse.urlencode(quoted_metadata)

        with ApiClient(
            config,
            limits=SandboxApiBase._limits,
        ) as api_client:
            res = get_sandboxes.sync_detailed(client=api_client, metadata=metadata)

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            return [
                ListedSandbox(
                    sandbox_id=sandbox.sandbox_id,
                    template_id=sandbox.template_id,
                    name=sandbox.alias if isinstance(sandbox.alias, str) else None,
                    metadata=(
                        sandbox.metadata if isinstance(sandbox.metadata, dict) else {}
                    ),
                    state=sandbox.state,
                    cpu_count=sandbox.cpu_count,
                    memory_mb=sandbox.memory_mb,
                    started_at=sandbox.started_at,
                    end_at=sandbox.end_at,
                )
                for sandbox in res.parsed
            ]

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
            limits=SandboxApiBase._limits,
        ) as api_client:
            res = get_sandboxes_sandbox_id.sync_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            return SandboxInfo(
                sandbox_id=res.parsed.sandbox_id,
                sandbox_domain=res.parsed.domain,
                template_id=res.parsed.template_id,
                name=res.parsed.alias if isinstance(res.parsed.alias, str) else None,
                metadata=(
                    res.parsed.metadata if isinstance(res.parsed.metadata, dict) else {}
                ),
                started_at=res.parsed.started_at,
                end_at=res.parsed.end_at,
                envd_version=res.parsed.envd_version,
                _envd_access_token=res.parsed.envd_access_token,
            )

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
            limits=SandboxApiBase._limits,
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
            limits=SandboxApiBase._limits,
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
        allow_internet_access: Optional[bool] = True,
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
            headers=headers,
            proxy=proxy,
        )

        with ApiClient(config, limits=SandboxApiBase._limits) as api_client:
            res = post_sandboxes.sync_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    secure=secure or False,
                    allow_internet_access=allow_internet_access,
                ),
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            if Version(res.parsed.envd_version) < Version("0.1.0"):
                SandboxApi._cls_kill(res.parsed.sandbox_id)
                raise TemplateException(
                    "You need to update the template to use the new SDK. "
                    "You can do this by running `e2b template build` in the directory with the template."
                )

            return SandboxCreateResponse(
                sandbox_id=res.parsed.sandbox_id,
                sandbox_domain=res.parsed.domain,
                envd_version=res.parsed.envd_version,
                envd_access_token=res.parsed.envd_access_token,
            )

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
