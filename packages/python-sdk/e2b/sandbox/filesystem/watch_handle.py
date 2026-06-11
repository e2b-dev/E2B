from dataclasses import dataclass
from enum import Enum
from typing import Optional

from e2b.envd.filesystem.filesystem_pb2 import EventType
from e2b.sandbox.filesystem.filesystem import EntryInfo


class FilesystemEventType(Enum):
    """
    Enum representing the type of filesystem event.
    """

    CHMOD = "chmod"
    """
    Filesystem object permissions were changed.
    """
    CREATE = "create"
    """
    Filesystem object was created.
    """
    REMOVE = "remove"
    """
    Filesystem object was removed.
    """
    RENAME = "rename"
    """
    Filesystem object was renamed.
    """
    WRITE = "write"
    """
    Filesystem object was written to.
    """


def map_event_type(event: EventType):
    if event == EventType.EVENT_TYPE_CHMOD:
        return FilesystemEventType.CHMOD
    elif event == EventType.EVENT_TYPE_CREATE:
        return FilesystemEventType.CREATE
    elif event == EventType.EVENT_TYPE_REMOVE:
        return FilesystemEventType.REMOVE
    elif event == EventType.EVENT_TYPE_RENAME:
        return FilesystemEventType.RENAME
    elif event == EventType.EVENT_TYPE_WRITE:
        return FilesystemEventType.WRITE


@dataclass
class FilesystemEvent:
    """
    Contains information about the filesystem event - the name of the file and the type of the event.
    """

    name: str
    """
    Relative path to the filesystem object.
    """
    type: FilesystemEventType
    """
    Filesystem operation event type.
    """
    entry: Optional[EntryInfo] = None
    """
    Information about the entry that triggered the event.

    Only populated when the watch was started with `include_entry=True` and the
    sandbox's envd version supports it. It may be `None` for events where the entry
    no longer exists at the path (e.g. remove or rename-away events).
    """
