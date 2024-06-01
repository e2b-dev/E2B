import logging

from typing import Optional, Dict, List
from pydantic import BaseModel
from datetime import datetime

from e2b.api import E2BApiClient, models, client
from e2b.connection_config import ConnectionConfig

logger = logging.getLogger(__name__)


class RunningSandbox(BaseModel):
    sandbox_id: str
    template_id: str
    name: Optional[str]
    metadata: Optional[Dict[str, str]]
    started_at: datetime


# TODO: Add requestTimeout


class SandboxApi:
    @staticmethod
    def list(
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> List[RunningSandbox]:
        config = ConnectionConfig(api_key=api_key, domain=domain, debug=debug)

        with E2BApiClient(config) as api_client:
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
                for sandbox in client.SandboxesApi(api_client).sandboxes_get()
            ]

    @staticmethod
    def kill(
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> None:
        config = ConnectionConfig(api_key=api_key, domain=domain, debug=debug)

        # TODO: Ensure the short id/long id works with kill

        with E2BApiClient(config) as api_client:
            client.SandboxesApi(api_client).sandboxes_sandbox_id_delete(
                sandbox_id,
            )

    @staticmethod
    def set_timeout(
        sandbox_id: str,
        timeout: int,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> None:
        config = ConnectionConfig(api_key=api_key, domain=domain, debug=debug)

        with E2BApiClient(config) as api_client:
            client.SandboxesApi(api_client).sandboxes_sandbox_id_timeout_post(
                sandbox_id,
                models.SandboxesSandboxIDTimeoutPostRequest(timeout=timeout),
            )

    @staticmethod
    def _create_sandbox(
        template: str,
        metadata: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ) -> str:
        config = ConnectionConfig(api_key=api_key, domain=domain, debug=debug)

        with E2BApiClient(config) as api_client:
            res = client.SandboxesApi(api_client).sandboxes_post(
                models.NewSandbox(
                    templateID=template,
                    metadata=metadata,
                    timeout=timeout,
                ),
            )

            return SandboxApi._get_sandbox_id(res.sandbox_id, res.client_id)

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"
