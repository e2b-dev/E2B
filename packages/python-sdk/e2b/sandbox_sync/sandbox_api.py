import datetime
import urllib.parse

from typing import Optional, Dict, List
from packaging.version import Version
from typing_extensions import Unpack

from e2b.sandbox.sandbox_api import (
    SandboxInfo,
    SandboxQuery,
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
    get_sandboxes,
    delete_sandboxes_sandbox_id,
    post_sandboxes,
    get_sandboxes_sandbox_id_metrics,
)
from e2b.connection_config import ConnectionConfig, ApiParams
from e2b.api import handle_api_exception


class SandboxApi(SandboxBase):
    @classmethod
    def list(
        cls,
        query: Optional[SandboxQuery] = None,
        **opts: Unpack[ApiParams],
    ) -> List[SandboxInfo]:
        """
        List all running sandboxes.

        :param query: Filter the list of sandboxes, e.g. by metadata `SandboxQuery(metadata={"key": "value"})`, if there are multiple filters, they are combined with AND.

        :return: List of running sandboxes
        """
        config = ConnectionConfig(**opts)

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
            limits=cls._limits,
        ) as api_client:
            res = get_sandboxes.sync_detailed(client=api_client, metadata=metadata)

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            return [SandboxInfo._from_listed_sandbox(sandbox) for sandbox in res.parsed]

    @classmethod
    def _cls_get_info(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> SandboxInfo:
        """
        Get the sandbox info.
        :param sandbox_id: Sandbox ID

        :return: Sandbox info
        """
        config = ConnectionConfig(**opts)

        with ApiClient(
            config,
            limits=cls._limits,
        ) as api_client:
            res = get_sandboxes_sandbox_id.sync_detailed(
                sandbox_id,
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise SandboxException("Body of the request is None")

            if isinstance(res.parsed, Error):
                raise SandboxException(f"{res.parsed.message}: Request failed")

            return SandboxInfo._from_sandbox_detail(res.parsed)

    @classmethod
    def _cls_kill(
        cls,
        sandbox_id: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        with ApiClient(
            config,
            limits=cls._limits,
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
        **opts: Unpack[ApiParams],
    ) -> None:
        config = ConnectionConfig(**opts)

        if config.debug:
            # Skip setting timeout in debug mode
            return

        with ApiClient(
            config,
            limits=cls._limits,
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
        allow_internet_access: Optional[bool] = True,
        **opts: Unpack[ApiParams],
    ) -> SandboxCreateResponse:
        config = ConnectionConfig(**opts)

        with ApiClient(config, limits=cls._limits) as api_client:
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
        **opts: Unpack[ApiParams],
    ) -> List[SandboxMetrics]:
        config = ConnectionConfig(**opts)

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
