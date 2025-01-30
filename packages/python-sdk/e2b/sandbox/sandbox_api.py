from abc import ABC
from dataclasses import dataclass
from typing import Literal, Optional, Dict
from datetime import datetime
from e2b.api.client.models.running_sandbox_state import RunningSandboxState
from httpx import Limits


@dataclass
class SandboxInfo:
    """Information about a sandbox."""

    sandbox_id: str
    """Sandbox ID."""
    template_id: str
    """Template ID."""
    name: Optional[str]
    """Sandbox name."""
    metadata: Dict[str, str]
    """Saved sandbox metadata."""
    started_at: datetime
    """Sandbox start time."""
    state: RunningSandboxState
    """Sandbox state."""


class SandboxApiBase(ABC):
    _limits = Limits(
        max_keepalive_connections=10,
        max_connections=20,
        keepalive_expiry=20,
    )

    @staticmethod
    def _get_sandbox_id(sandbox_id: str, client_id: str) -> str:
        return f"{sandbox_id}-{client_id}"
