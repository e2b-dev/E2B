from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import List, Literal, Optional, TypedDict, Union

from typing_extensions import NotRequired


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
    names: List[str] = field(default_factory=list)
    # Deprecated: use names instead
    alias: str = ""


@dataclass
class TagInfo:
    """
    Information about assigned tags.
    """

    build_id: str
    tags: List[str]


def normalize_names(
    names: Optional[Union[str, List[str]]], alias: Optional[str] = None
) -> List[str]:
    """
    Normalize names parameter to a list if string provided.

    :param names: Single name string or list of names
    :param alias: (Deprecated) Alias name for the template. Use names instead.
    :return: List of names
    """

    if alias is not None and names is not None:
        raise ValueError("Either names or alias must be provided")

    names_list = []
    if names is not None:
        if isinstance(names, str):
            names_list.append(names)
        else:
            names_list.extend(names)

    if alias is not None:
        names_list.append(alias)

    if len(names_list) == 0:
        raise ValueError("Either names or alias must be provided")

    return names_list
