from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

from e2b.api.client.models import (
    Template as TemplateModel,
)
from e2b.api.client.models import (
    TeamUser,
    TemplateBuildStatus,
)


@dataclass
class TemplateInfo:
    """Information about a sandbox template."""

    template_id: str
    """Identifier of the template."""
    build_id: str
    """Identifier of the last successful build for the template."""
    cpu_count: int
    """Number of CPUs the template is configured with."""
    memory_mb: int
    """Amount of memory in MiB the template is configured with."""
    disk_size_mb: int
    """Disk size of the template in MiB."""
    public: bool
    """Whether the template is public or only accessible by the team."""
    aliases: List[str]
    """Aliases of the template."""
    names: List[str]
    """Names of the template (namespace/alias format when namespaced)."""
    created_at: datetime
    """Time when the template was created."""
    updated_at: datetime
    """Time when the template was last updated."""
    last_spawned_at: Optional[datetime]
    """Time when the template was last used, or None if it was never used."""
    spawn_count: int
    """Number of times a sandbox was spawned from the template."""
    build_count: int
    """Number of times the template was built."""
    envd_version: str
    """Version of envd the template was built with."""
    created_by: Optional[TeamUser]
    """User who created the template, or None if not available."""
    build_status: TemplateBuildStatus
    """Status of the last build for the template."""

    @classmethod
    def _from_template(cls, template: TemplateModel) -> "TemplateInfo":
        return cls(
            template_id=template.template_id,
            build_id=template.build_id,
            cpu_count=template.cpu_count,
            memory_mb=template.memory_mb,
            disk_size_mb=template.disk_size_mb,
            public=template.public,
            aliases=list(template.aliases) if template.aliases else [],
            names=list(template.names) if template.names else [],
            created_at=template.created_at,
            updated_at=template.updated_at,
            last_spawned_at=(
                template.last_spawned_at
                if isinstance(template.last_spawned_at, datetime)
                else None
            ),
            spawn_count=template.spawn_count,
            build_count=template.build_count,
            envd_version=template.envd_version,
            created_by=template.created_by,
            build_status=template.build_status,
        )
