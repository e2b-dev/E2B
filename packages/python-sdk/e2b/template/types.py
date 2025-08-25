from typing import List, Optional, TypedDict, Union
from typing_extensions import NotRequired


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


class Step(Instruction):
    filesHash: NotRequired[str]


class TemplateType(TypedDict):
    fromImage: NotRequired[str]
    fromTemplate: NotRequired[str]
    startCmd: NotRequired[str]
    readyCmd: NotRequired[str]
    readyCmdTimeoutMs: NotRequired[int]
    steps: List[Step]
    force: bool


Duration = Union[str, int]  # Can be "5s", "10m", "2h", "1d" or just a number
