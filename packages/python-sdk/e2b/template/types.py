from enum import Enum
from pathlib import Path
from typing import List, Optional, TypedDict, Union
from typing import Literal

from typing_extensions import NotRequired


class InstructionType(str, Enum):
    COPY = "COPY"
    ENV = "ENV"
    RUN = "RUN"
    WORKDIR = "WORKDIR"
    USER = "USER"


class CopyItem(TypedDict):
    src: Union[Union[str, Path], List[Union[str, Path]]]
    dest: Union[str, Path]
    forceUpload: NotRequired[Optional[Literal[True]]]
    user: NotRequired[Optional[str]]
    mode: NotRequired[Optional[int]]
    resolveSymlinks: NotRequired[Optional[bool]]


class Instruction(TypedDict):
    type: InstructionType
    args: List[str]
    force: bool
    forceUpload: NotRequired[Optional[Literal[True]]]
    filesHash: NotRequired[Optional[str]]
    resolveSymlinks: NotRequired[Optional[bool]]


class GenericDockerRegistry(TypedDict):
    type: Literal["registry"]
    username: str
    password: str


class AWSRegistry(TypedDict):
    type: Literal["aws"]
    awsAccessKeyId: str
    awsSecretAccessKey: str
    awsRegion: str


class GCPRegistry(TypedDict):
    type: Literal["gcp"]
    serviceAccountJson: str


RegistryConfig = Union[GenericDockerRegistry, AWSRegistry, GCPRegistry]


class TemplateType(TypedDict):
    fromImage: NotRequired[str]
    fromTemplate: NotRequired[str]
    fromImageRegistry: NotRequired[RegistryConfig]
    startCmd: NotRequired[str]
    readyCmd: NotRequired[str]
    steps: List[Instruction]
    force: bool
