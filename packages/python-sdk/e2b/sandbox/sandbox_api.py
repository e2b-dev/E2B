from abc import ABC
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

from httpx import Limits

from e2b.api.client.models.sandbox_state import SandboxState
from e2b.api.client.models.listed_sandbox import ListedSandbox


@dataclass
class SandboxInfo:
    """Information about a sandbox."""

    sandbox_id: str
    """Sandbox ID."""
    template_id: str
    """Template ID."""
    name: Optional[str]
    """Template name."""
    metadata: Dict[str, str]
    """Saved sandbox metadata."""
    started_at: datetime
    """Sandbox start time."""
    state: SandboxState
    """Sandbox state."""

    @staticmethod
    def from_listed_sandbox(listed_sandbox: ListedSandbox) -> "SandboxInfo":
        return SandboxInfo(
            sandbox_id=SandboxApiBase._get_sandbox_id(
                listed_sandbox.sandbox_id,
                listed_sandbox.client_id,
            ),
            template_id=listed_sandbox.template_id,
            name=(
                listed_sandbox.alias if isinstance(listed_sandbox.alias, str) else None
            ),
            metadata=(
                listed_sandbox.metadata
                if isinstance(listed_sandbox.metadata, dict)
                else {}
            ),
            started_at=listed_sandbox.started_at,
            state=listed_sandbox.state,
        )


@dataclass
class SandboxListQuery:
    """Query parameters for listing sandboxes."""

    metadata: Optional[dict[str, str]] = None

    """Filter sandboxes by metadata."""
    state: Optional[List[SandboxState]] = None

    """Filter sandboxes by state."""


@dataclass
class SandboxMetrics:
    """Sandbox resource usage metrics"""

    timestamp: datetime
    """Timestamp of the metrics."""
    cpu_used_pct: float
    """CPU usage in percentage."""
    cpu_count: int
    """Number of CPU cores."""
    mem_used_mib: int
    """Memory usage in bytes."""
    mem_total_mib: int
    """Total memory available"""


class SandboxApiBase(ABC):
    _limits = Limits(
        max_keepalive_connections=10,
        max_connections=20,
        keepalive_expiry=20,
    )

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"
