from dataclasses import dataclass
from typing import Optional, Dict, List
from datetime import datetime

from e2b.api import ApiClient, models, client, exceptions
from e2b.connection_config import ConnectionConfig
from e2b.api import handle_api_exception


@dataclass
class RunningSandbox:
    sandbox_id: str
    template_id: str
    name: Optional[str]
    metadata: Optional[Dict[str, str]]
    started_at: datetime


class SandboxApi:
    @staticmethod
    def list(
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        request_timeout: Optional[float] = None,
    ) -> List[RunningSandbox]:
        config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        with ApiClient(config) as api_client:
            try:
                return [
                    RunningSandbox(
                        sandbox_id=SandboxApi._get_sandbox_id(
                            sandbox.sandbox_id,
                            sandbox.client_id,
                        ),
                        template_id=sandbox.template_id,
                        name=sandbox.alias,
                        metadata=sandbox.metadata,
                        started_at=sandbox.started_at,
                    )
                    for sandbox in client.SandboxesApi(api_client).sandboxes_get(
                        _request_timeout=config.request_timeout,
                    )
                ]
            except exceptions.ApiException as e:
                raise handle_api_exception(e)

    @staticmethod
    def kill(
        sandbox_id: str,
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

        with ApiClient(config) as api_client:
            try:
                client.SandboxesApi(api_client).sandboxes_sandbox_id_delete(
                    sandbox_id,
                    _request_timeout=config.request_timeout,
                )
            except exceptions.ApiException as e:
                raise handle_api_exception(e)

    @staticmethod
    def set_timeout(
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

        with ApiClient(config) as api_client:
            try:
                client.SandboxesApi(api_client).sandboxes_sandbox_id_timeout_post(
                    sandbox_id,
                    models.SandboxesSandboxIDTimeoutPostRequest(timeout=timeout),
                    _request_timeout=config.request_timeout,
                )
            except exceptions.ApiException as e:
                raise handle_api_exception(e)

    @staticmethod
    def _create_sandbox(
        template: str,
        metadata: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
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

        with ApiClient(config) as api_client:
            try:
                res = client.SandboxesApi(api_client).sandboxes_post(
                    models.NewSandbox(
                        templateID=template,
                        metadata=metadata,
                        timeout=timeout,
                    ),
                    _request_timeout=config.request_timeout,
                )
                return SandboxApi._get_sandbox_id(res.sandbox_id, res.client_id)
            except exceptions.ApiException as e:
                raise handle_api_exception(e)

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"
