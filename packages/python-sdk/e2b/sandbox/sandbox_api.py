from dataclasses import dataclass
from typing import Optional, Dict, Union
from datetime import datetime

from e2b.api.client.models import SandboxState, SandboxDetail, ListedSandbox


@dataclass
class SandboxInfo:
    """Information about a sandbox."""

    sandbox_id: str
    """Sandbox ID."""
    sandbox_domain: Optional[str]
    """Domain where the sandbox is hosted."""
    template_id: str
    """Template ID."""
    name: Optional[str]
    """Template name."""
    metadata: Dict[str, str]
    """Saved sandbox metadata."""
    started_at: datetime
    """Sandbox start time."""
    end_at: datetime
    """Sandbox expiration date."""
    state: SandboxState
    """Sandbox state."""
    cpu_count: int
    """Sandbox CPU count."""
    memory_mb: int
    """Sandbox Memory size in MiB."""
    envd_version: str
    """Envd version."""
    _envd_access_token: Optional[str]
    """Envd access token."""

    @classmethod
    def _from_sandbox_data(
        cls,
        sandbox: Union[ListedSandbox, SandboxDetail],
        envd_access_token: Optional[str] = None,
        sandbox_domain: Optional[str] = None,
    ):
        return cls(
            sandbox_domain=sandbox_domain,
            sandbox_id=sandbox.sandbox_id,
            template_id=sandbox.template_id,
            name=(sandbox.alias if isinstance(sandbox.alias, str) else None),
            metadata=(sandbox.metadata if isinstance(sandbox.metadata, dict) else {}),
            started_at=sandbox.started_at,
            end_at=sandbox.end_at,
            state=sandbox.state,
            cpu_count=sandbox.cpu_count,
            memory_mb=sandbox.memory_mb,
            envd_version=sandbox.envd_version,
            _envd_access_token=envd_access_token,
        )

    @classmethod
    def _from_listed_sandbox(cls, listed_sandbox: ListedSandbox):
        return cls._from_sandbox_data(listed_sandbox)

    @classmethod
    def _from_sandbox_detail(cls, sandbox_detail: SandboxDetail):
        return cls._from_sandbox_data(
            sandbox_detail,
            (
                sandbox_detail.envd_access_token
                if isinstance(sandbox_detail.envd_access_token, str)
                else None
            ),
            sandbox_domain=(
                sandbox_detail.domain
                if isinstance(sandbox_detail.domain, str)
                else None
            ),
        )


@dataclass
class SandboxQuery:
    """Query parameters for listing sandboxes."""

    metadata: Optional[dict[str, str]] = None
    """Filter sandboxes by metadata."""


@dataclass
class SandboxMetrics:
    """Sandbox metrics."""

    cpu_count: int
    """Number of CPUs."""
    cpu_used_pct: float
    """CPU usage percentage."""
    disk_total: int
    """Total disk space in bytes."""
    disk_used: int
    """Disk used in bytes."""
    mem_total: int
    """Total memory in bytes."""
    mem_used: int
    """Memory used in bytes."""
    timestamp: datetime
    """Timestamp of the metric entry."""
