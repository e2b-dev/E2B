from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import (
    Any,
    List,
    Literal,
    NotRequired,
    Optional,
    Self,
    TypedDict,
    Union,
)

from e2b.api.client.models import Template as TemplateModel
from e2b.api.client.models import TemplateBuild as TemplateBuildModel
from e2b.api.client.models import TemplateBuildWithTags as TemplateBuildWithTagsModel
from e2b.api.client.models import TemplateV2 as TemplateV2Model
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

    max_cpu_count: Optional[int] = None
    """Maximum number of CPUs a sandbox can be started with. Set only for resizable templates."""

    max_memory_mb: Optional[int] = None
    """Memory in MiB a sandbox can be started with at most. Set only for templates whose memory is resizable."""

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
            max_cpu_count=(
                None
                if isinstance(template.max_cpu_count, Unset)
                else template.max_cpu_count
            ),
            max_memory_mb=(
                None
                if isinstance(template.max_memory_mb, Unset)
                else template.max_memory_mb
            ),
        )


@dataclass
class TemplateBuildInfo:
    """
    Information about a template build.
    """

    build_id: str
    """Build identifier."""

    status: TemplateBuildStatus
    """Status of the build."""

    cpu_count: int
    """Number of CPUs a sandbox created from the build starts with."""

    memory_mb: int
    """Amount of memory in MiB a sandbox created from the build starts with."""

    created_at: datetime
    """When the build was created."""

    updated_at: datetime
    """When the build was last updated."""

    finished_at: Optional[datetime] = None
    """When the build finished."""

    max_cpu_count: Optional[int] = None
    """Maximum number of CPUs a sandbox can be started with. Set only for resizable builds."""

    max_memory_mb: Optional[int] = None
    """Memory in MiB a sandbox can be started with at most. Set only for builds whose memory is resizable."""

    disk_size_mb: Optional[int] = None
    """Disk size in MiB of the sandbox."""

    envd_version: Optional[str] = None
    """Version of envd running in the sandbox."""

    @classmethod
    def _from_model(
        cls,
        build: Union[TemplateBuildModel, TemplateBuildWithTagsModel],
        **subclass_fields: Any,
    ) -> Self:
        return cls(
            build_id=str(build.build_id),
            status=TemplateBuildStatus(build.status.value),
            cpu_count=build.cpu_count,
            memory_mb=build.memory_mb,
            created_at=build.created_at,
            updated_at=build.updated_at,
            finished_at=(
                None if isinstance(build.finished_at, Unset) else build.finished_at
            ),
            max_cpu_count=(
                None if isinstance(build.max_cpu_count, Unset) else build.max_cpu_count
            ),
            max_memory_mb=(
                None if isinstance(build.max_memory_mb, Unset) else build.max_memory_mb
            ),
            disk_size_mb=(
                None if isinstance(build.disk_size_mb, Unset) else build.disk_size_mb
            ),
            envd_version=(
                None if isinstance(build.envd_version, Unset) else build.envd_version
            ),
            **subclass_fields,
        )


@dataclass
class TemplateBuildWithTags(TemplateBuildInfo):
    """
    A template build with the tags that point at it, as listed by `Template.list_builds`.
    """

    tags: List[str] = field(kw_only=True)
    """Tags of the template that point at this build. A tag points at the latest
    ready build it was assigned to, the build a sandbox created with that tag starts from."""

    @classmethod
    def _from_model_with_tags(cls, build: TemplateBuildWithTagsModel) -> Self:
        return cls._from_model(build, tags=list(build.tags))


@dataclass
class TemplateDetail:
    """
    A template with its default build, as returned by `Template.get_info`.

    The build fields that `TemplateInfo` (an item of `Template.list`) carries at
    the top level, such as `build_id` and `cpu_count`, are under `default_build` here.
    """

    template_id: str
    """Template identifier."""

    names: List[str]
    """Names of the template (`namespace/name` when namespaced)."""

    public: bool
    """Whether the template is public or only accessible by the project."""

    is_default: bool
    """Whether the template is one of the platform's default templates."""

    build_status: TemplateBuildStatus
    """Status of the latest build tagged `default`, in any state. It is `waiting` or
    `building` while a rebuild runs and `error` after a failed one, although sandboxes
    still start from `default_build`."""

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

    default_build: Optional[TemplateBuildInfo] = None
    """Build a sandbox created without a tag starts from: the latest ready build
    tagged `default`, so its `status` is always `ready`. Not set until such a build is ready."""

    @classmethod
    def _from_model(cls, template: TemplateV2Model) -> "TemplateDetail":
        return cls(
            template_id=template.template_id,
            names=list(template.names),
            public=template.public,
            is_default=template.is_default,
            build_status=TemplateBuildStatus(template.build_status.value),
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
            default_build=(
                None
                if isinstance(template.default_build, Unset)
                else TemplateBuildInfo._from_model(template.default_build)
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
