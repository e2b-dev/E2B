from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from e2b.template.utils import strip_ansi_escape_codes


@dataclass
class LogEntry:
    timestamp: datetime
    level: Literal["debug", "info", "warn", "error"]
    message: str

    def __post_init__(self):
        self.message = strip_ansi_escape_codes(self.message)

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] [{self.level}] {self.message}"

