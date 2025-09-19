from typing import List, Optional, TypedDict, Union
from typing_extensions import NotRequired
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from enum import Enum
from e2b.template.utils import strip_ansi_escape_codes


class InstructionType(Enum):
    COPY = "COPY"
    ENV = "ENV"
    RUN = "RUN"
    WORKDIR = "WORKDIR"
    USER = "USER"


class CopyItem(TypedDict):
    src: str
    dest: str
    forceUpload: NotRequired[Optional[bool]]
    user: NotRequired[Optional[str]]
    mode: NotRequired[Optional[int]]


class Instruction(TypedDict):
    type: InstructionType
    args: List[str]
    force: bool
    forceUpload: NotRequired[Optional[bool]]
    filesHash: NotRequired[Optional[str]]


@dataclass
class LogEntry:
    timestamp: datetime
    level: Literal["debug", "info", "warn", "error"]
    message: str

    def __post_init__(self):
        self.message = strip_ansi_escape_codes(self.message)

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] [{self.level}] {self.message}"


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
