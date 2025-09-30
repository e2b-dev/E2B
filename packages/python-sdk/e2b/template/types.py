from typing import List, Optional, TypedDict, Union
from typing_extensions import NotRequired
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from enum import Enum
from pathlib import Path
from e2b.template.utils import strip_ansi_escape_codes


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


LogEntryLevel = Literal["debug", "info", "warn", "error"]


@dataclass
class LogEntry:
    timestamp: datetime
    level: LogEntryLevel
    message: str

    def __post_init__(self):
        self.message = strip_ansi_escape_codes(self.message)

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] [{self.level}] {self.message}"


@dataclass
class LogEntryStart(LogEntry):
    def __init__(self, timestamp: datetime, message: str):
        super().__init__(timestamp, "debug", message)


@dataclass
class LogEntryEnd(LogEntry):
    def __init__(self, timestamp: datetime, message: str):
        super().__init__(timestamp, "debug", message)


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
