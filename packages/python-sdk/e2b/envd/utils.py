from typing import Optional


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
