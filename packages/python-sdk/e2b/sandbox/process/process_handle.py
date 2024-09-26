from dataclasses import dataclass
from typing import Optional

from e2b.exceptions import SandboxException

Stdout = str
Stderr = str
PtyOutput = bytes


@dataclass
class PtySize:
    rows: int
    cols: int


@dataclass
class ProcessResult:
    stderr: str
    stdout: str
    exit_code: int
    error: Optional[str]


@dataclass
class ProcessExitException(SandboxException, ProcessResult):
    def __str__(self):
        return f"Process exited with code {self.exit_code} and error: {self.error}\n{self.stderr}"
