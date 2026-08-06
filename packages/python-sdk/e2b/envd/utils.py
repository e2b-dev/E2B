"""Helpers shared by the envd RPC call sites (commands, PTY, filesystem)."""

import base64

from typing import Optional, Union
from packaging.version import Version
from protobuf import Oneof

from e2b.connection_config import Username, default_username
from e2b.envd.process import process_pb
from e2b.envd.versions import ENVD_DEFAULT_USER
from e2b.exceptions import SandboxException


def timeout_to_ms(timeout: Optional[float]) -> Optional[int]:
    """Convert a timeout in seconds to the ``timeout_ms`` connectrpc calls
    expect. ``None`` and ``0`` (timeout disabled) map to ``None`` — connectrpc
    treats a non-positive deadline as already expired. Positive values map to
    at least 1 ms so a sub-millisecond timeout stays a deadline instead of
    the 0 that connectrpc's ``timeout_ms or default`` fallback would
    discard."""
    if not timeout:
        return None
    return max(1, round(timeout * 1000))


def extract_start_pid(
    start_event: Union[process_pb.StartResponse, process_pb.ConnectResponse],
    action: str,
) -> int:
    """Return the pid carried by the ``start`` event that must open a process
    stream (start/connect), raising :class:`SandboxException` when the stream
    opened with anything else."""
    # `event.event` is the ProcessEvent; its `event` oneof holds the payload.
    match start_event.event.event if start_event.event is not None else None:
        case Oneof(field="start", value=start):
            return start.pid
        case _:
            raise SandboxException(
                f"Failed to {action}: expected start event, got {start_event}"
            )


def authentication_header(
    envd_version: Version, user: Optional[Username] = None
) -> dict[str, str]:
    if user is None and envd_version < ENVD_DEFAULT_USER:
        user = default_username

    if not user:
        return {}

    value = f"{user}:"

    encoded = base64.b64encode(value.encode("utf-8")).decode("utf-8")

    return {"Authorization": f"Basic {encoded}"}
