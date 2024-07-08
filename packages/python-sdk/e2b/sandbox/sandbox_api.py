from dataclasses import dataclass
from typing import Optional, Dict
from datetime import datetime


@dataclass
class SandboxInfo:
    """Information about a sandbox."""

    sandbox_id: str
    """Sandbox ID."""
    template_id: str
    """Template ID."""
    name: Optional[str]
    """Sandbox name."""
    metadata: Optional[Dict[str, str]]
    """Saved sandbox metadata."""
    started_at: datetime
    """Sandbox start time."""
