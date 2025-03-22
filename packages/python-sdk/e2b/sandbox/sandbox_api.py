from abc import ABC
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from httpx import Limits


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


@dataclass
class SandboxQuery:
    """Query parameters for listing sandboxes."""

    metadata: Optional[dict[str, str]] = None
    """Filter sandboxes by metadata."""


class SandboxApiBase(ABC):
    _limits = Limits(
        max_keepalive_connections=10,
        max_connections=20,
        keepalive_expiry=20,
    )

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"
