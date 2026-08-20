from dataclasses import dataclass
from datetime import datetime
from typing import Dict

from e2b.api.client.models import Secret as SecretModel


@dataclass
class SecretInfo:
    """Metadata of a secret. Secret values are write-only and never returned."""

    secret_id: str
    """Secret ID."""
    name: str
    """Secret name, unique within the project."""
    version: int
    """Version served to readers that do not name one."""
    metadata: Dict[str, str]
    """Customer metadata of the secret."""
    created_at: datetime
    """Time when the secret was created."""
    updated_at: datetime
    """Time when the secret was last updated."""

    @classmethod
    def _from_model(cls, secret: SecretModel) -> "SecretInfo":
        return cls(
            secret_id=secret.secret_id,
            name=secret.name,
            version=secret.current_version,
            metadata=dict(secret.metadata.additional_properties),
            created_at=secret.created_at,
            updated_at=secret.updated_at,
        )
