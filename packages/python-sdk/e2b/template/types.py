from typing import List, Optional, TypedDict
from typing_extensions import NotRequired
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from e2b.template.utils import strip_ansi_escape_codes


class CopyItem(TypedDict):
    src: str
    dest: str
    forceUpload: NotRequired[Optional[bool]]
    user: NotRequired[Optional[str]]
    mode: NotRequired[Optional[int]]


class Instruction(TypedDict):
    type: str
    args: List[str]
    force: bool
    forceUpload: Optional[bool]
    filesHash: NotRequired[str]


class TemplateType(TypedDict):
    fromImage: NotRequired[str]
    fromTemplate: NotRequired[str]
    startCmd: NotRequired[str]
    readyCmd: NotRequired[str]
    readyCmdTimeoutMs: NotRequired[int]
    steps: List[Instruction]
    force: bool


@dataclass
class LogEntry:
    timestamp: datetime
    level: Literal["debug", "info", "warn", "error"]
    message: str

    def __post_init__(self):
        self.message = strip_ansi_escape_codes(self.message)

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] [{self.level}] {self.message}"
