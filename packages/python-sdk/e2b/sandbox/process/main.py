from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ProcessInfo:
    pid: int
    tag: Optional[str]
    cmd: str
    args: List[str]
    envs: Dict[str, str]
    cwd: Optional[str]
