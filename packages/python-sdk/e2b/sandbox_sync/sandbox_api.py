from typing import Dict, List, Optional

from e2b.api import ApiClient, handle_api_exception
from e2b.api.client.api.sandboxes import (
    delete_sandboxes_sandbox_id,
    get_sandboxes,
    post_sandboxes,
    post_sandboxes_sandbox_id_pause,
    post_sandboxes_sandbox_id_resume,
    post_sandboxes_sandbox_id_timeout,
)
from e2b.api.client.models import (
    NewSandbox,
    PostSandboxesSandboxIDTimeoutBody,
    ResumedSandbox,
)
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import TemplateException, NotFoundException
from e2b.sandbox.sandbox_api import SandboxApiBase, SandboxInfo
from httpx import HTTPTransport
from packaging.version import Version


class SandboxApi(SandboxApiBase):
    @classmethod
    def list(
        cls,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> List[SandboxInfo]:
        """
        List all running sandboxes.

        :param api_key: API key to use for authentication, defaults to `E2B_API_KEY` environment variable
        :param request_timeout: Timeout for the request in **seconds**

        :return: List of sandbox info
        """
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
        ) as api_client:
            res = get_sandboxes.sync_detailed(
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                return []

            return [
                SandboxInfo(
                    sandbox_id=SandboxApi._get_sandbox_id(
                        sandbox.sandbox_id,
                        sandbox.client_id,
                    ),
                    template_id=sandbox.template_id,
                    name=sandbox.alias if isinstance(sandbox.alias, str) else None,
                    metadata=(
                        sandbox.metadata if isinstance(sandbox.metadata, dict) else {}
                    ),
                    started_at=sandbox.started_at,
                )
                for sandbox in res.parsed
            ]

    @classmethod
    def _cls_kill(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if config.debug:
            # Skip killing the sandbox in debug mode
            return True

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
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
    ) -> None:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if config.debug:
            # Skip setting timeout in debug mode
            return

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
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
        auto_pause: bool,
        metadata: Optional[Dict[str, str]] = None,
        env_vars: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> str:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
        ) as api_client:
            res = post_sandboxes.sync_detailed(
                body=NewSandbox(
                    template_id=template,
                    metadata=metadata or {},
                    timeout=timeout,
                    env_vars=env_vars or {},
                    auto_pause=auto_pause,
                ),
                client=api_client,
            )

            if res.status_code >= 300:
                raise handle_api_exception(res)

            if res.parsed is None:
                raise Exception("Body of the request is None")

            if Version(res.parsed.envd_version) < Version("0.1.0"):
                SandboxApi._cls_kill(
                    SandboxApi._get_sandbox_id(
                        res.parsed.sandbox_id,
                        res.parsed.client_id,
                    )
                )
                raise TemplateException(
                    "You need to update the template to use the new SDK. "
                    "You can do this by running `e2b template build` in the directory with the template."
                )

            return SandboxApi._get_sandbox_id(
                res.parsed.sandbox_id,
                res.parsed.client_id,
            )

    @classmethod
    def _cls_resume(
        cls,
        sandbox_id: str,
        timeout: int,
        auto_pause: bool,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
        ) as api_client:
            res = post_sandboxes_sandbox_id_resume.sync_detailed(
                sandbox_id,
                client=api_client,
                body=ResumedSandbox(timeout=timeout, auto_pause=auto_pause),
            )

            if res.status_code == 404:
                raise NotFoundException(f"Paused sandbox {sandbox_id} not found")

            if res.status_code == 409:
                return False

            if res.status_code >= 300:
                raise handle_api_exception(res)

            return True

    @classmethod
    def _cls_pause(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> bool:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        with ApiClient(
            config, transport=HTTPTransport(limits=SandboxApiBase._limits)
        ) as api_client:
            res = post_sandboxes_sandbox_id_pause.sync_detailed(
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
