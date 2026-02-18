from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import List, Literal, Optional, TypedDict, Union

from typing_extensions import NotRequired

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
    """Build logs (raw strings). Deprecated: use log_entries instead."""

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
