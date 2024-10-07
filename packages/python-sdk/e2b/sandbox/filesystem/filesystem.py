from enum import Enum
from dataclasses import dataclass
from typing import IO, Optional, Union

from e2b.envd.filesystem import filesystem_pb2


class FileType(Enum):
    FILE = "file"
    DIR = "dir"


def map_file_type(ft: filesystem_pb2.FileType):
    if ft == filesystem_pb2.FileType.FILE_TYPE_FILE:
        return FileType.FILE
    elif ft == filesystem_pb2.FileType.FILE_TYPE_DIRECTORY:
        return FileType.DIR


@dataclass
class EntryInfo:
    name: str
    type: Optional[FileType]
    path: str

WriteData = Union[str, bytes, IO]

@dataclass
class FileWriteData:
    path: str
    data: WriteData
