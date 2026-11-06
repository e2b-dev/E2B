from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Literal, NotRequired, Optional, TypedDict, Union

from e2b.api.client.models import Template as TemplateModel
from e2b.api.client.types import Unset
from e2b.template.logger import LogEntry


class TemplateBuildStatus(str, Enum):
    """
    Status of a template build.
    """

    BUILDING = "building"
    WAITING = "waiting"
    READY = "ready"
    ERROR = "error"


@dataclass
class BuildStatusReason:
    """
    Reason for the current build status (typically for errors).
    """

    message: str
    """Message with the status reason."""

    step: Optional[str] = None
    """Step that failed."""

    log_entries: List[LogEntry] = field(default_factory=list)
    """Log entries related to the status reason."""


@dataclass
class TemplateBuildStatusResponse:
    """
    Response from getting build status.
    """

    build_id: str
    """Build identifier."""

    template_id: str
    """Template identifier."""

    status: TemplateBuildStatus
    """Current status of the build."""

    log_entries: List[LogEntry]
    """Build log entries."""

    logs: List[str]
    """Build logs (raw strings). Always empty since the V1 build path was removed.
    :deprecated: Use `log_entries` instead. Will be removed in the next major version.
    """

    reason: Optional[BuildStatusReason] = None
    """Reason for the current status (typically for errors)."""


@dataclass
class TemplateTagInfo:
    """
    Information about assigned template tags.
    """

    build_id: str
    """Build identifier associated with this tag."""

    tags: List[str]
    """Assigned tags of the template."""


@dataclass
class TemplateInfo:
    """
    Information about a template.
    """

    template_id: str
    """Template identifier."""

    build_id: str
    """Identifier of the last successful build of the template."""

    names: List[str]
    """Names of the template (`namespace/name` when namespaced)."""

    public: bool
    """Whether the template is public or only accessible by the project."""

    is_default: bool
    """Whether the template is one of the platform's default templates."""

    build_status: TemplateBuildStatus
    """Status of the last template build."""

    cpu_count: int
    """Number of CPUs allocated to the sandbox."""

    memory_mb: int
    """Amount of memory in MiB allocated to the sandbox."""

    disk_size_mb: int
    """Disk size in MiB of the sandbox."""

    envd_version: str
    """Version of envd running in the sandbox."""

    build_count: int
    """Number of times the template was built."""

    spawn_count: int
    """Number of times the template was used to create a sandbox."""

    created_at: datetime
    """When the template was created."""

    updated_at: datetime
    """When the template was last updated."""

    last_spawned_at: Optional[datetime] = None
    """When the template was last used to create a sandbox."""

    description: Optional[str] = None
    """Description of the template."""

    @classmethod
    def _from_model(cls, template: TemplateModel) -> "TemplateInfo":
        return cls(
            template_id=template.template_id,
            build_id=template.build_id,
            names=list(template.names),
            public=template.public,
            is_default=(
                False if isinstance(template.is_default, Unset) else template.is_default
            ),
            build_status=TemplateBuildStatus(template.build_status.value),
            cpu_count=template.cpu_count,
            memory_mb=template.memory_mb,
            disk_size_mb=template.disk_size_mb,
            envd_version=template.envd_version,
            build_count=template.build_count,
            spawn_count=template.spawn_count,
            created_at=template.created_at,
            updated_at=template.updated_at,
            last_spawned_at=template.last_spawned_at,
            description=(
                None
                if isinstance(template.description, Unset)
                else template.description or None
            ),
        )


@dataclass
class TemplateTag:
    """
    Detailed information about a single template tag.
    """

    tag: str
    """Name of the tag."""

    build_id: str
    """Build identifier associated with this tag."""

    created_at: datetime
    """When this tag was assigned."""


class InstructionType(str, Enum):
    """
    Types of instructions that can be used in a template.
    """

    COPY = "COPY"
    ENV = "ENV"
    RUN = "RUN"
    WORKDIR = "WORKDIR"
    USER = "USER"


class CopyItem(TypedDict):
    """
    Configuration for a single file/directory copy operation.
    """

    src: Union[Union[str, Path], List[Union[str, Path]]]
    dest: Union[str, Path]
    forceUpload: NotRequired[Optional[Literal[True]]]
    user: NotRequired[Optional[str]]
    mode: NotRequired[Optional[int]]
    resolveSymlinks: NotRequired[Optional[bool]]
    gzip: NotRequired[Optional[bool]]


class Instruction(TypedDict):
    """
    Represents a single instruction in the template build process.
    """

    type: InstructionType
    args: List[str]
    force: bool
    forceUpload: NotRequired[Optional[Literal[True]]]
    filesHash: NotRequired[Optional[str]]
    resolveSymlinks: NotRequired[Optional[bool]]
    gzip: NotRequired[Optional[bool]]


class GenericDockerRegistry(TypedDict):
    """
    Configuration for a generic Docker registry with basic authentication.
    """

    type: Literal["registry"]
    username: str
    password: str


class AWSRegistry(TypedDict):
    """
    Configuration for AWS Elastic Container Registry (ECR).
    """

    type: Literal["aws"]
    awsAccessKeyId: str
    awsSecretAccessKey: str
    awsRegion: str


class GCPRegistry(TypedDict):
    """
    Configuration for Google Container Registry (GCR) or Artifact Registry.
    """

    type: Literal["gcp"]
    serviceAccountJson: str


"""
Union type for all supported container registry configurations.
"""
RegistryConfig = Union[GenericDockerRegistry, AWSRegistry, GCPRegistry]


class TemplateType(TypedDict):
    """
    Internal representation of a template for the E2B build API.
    """

    fromImage: NotRequired[str]
    fromTemplate: NotRequired[str]
    fromImageRegistry: NotRequired[RegistryConfig]
    startCmd: NotRequired[str]
    readyCmd: NotRequired[str]
    steps: List[Instruction]
    force: bool


@dataclass
class BuildInfo:
    """
    Information about a built template.
    """

    template_id: str
    build_id: str
    name: str
    # Deprecated: use name instead
    alias: str
    tags: List[str] = field(default_factory=list)
