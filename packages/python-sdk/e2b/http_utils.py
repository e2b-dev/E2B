"""Shared helpers for parsing HTTP response details, usable by both the main
API client and the envd API client without either depending on the other.
"""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from math import ceil
from typing import Optional


def parse_retry_after(retry_after: Optional[str]) -> Optional[int]:
    """Parse a ``Retry-After`` header value (RFC 9110 §10.2.3): either
    delta-seconds or an HTTP-date. Returns ``None`` when the value is
    absent or doesn't parse as either form (including a negative or
    signed delta-seconds, which the RFC doesn't allow).
    """
    if not retry_after:
        return None

    retry_after = retry_after.strip()

    if retry_after.isdecimal():
        return int(retry_after)

    if retry_after[:1] in ("+", "-") or retry_after[:1].isdigit():
        return None

    try:
        retry_at = parsedate_to_datetime(retry_after)
    except (TypeError, ValueError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)

    return max(0, ceil((retry_at - datetime.now(timezone.utc)).total_seconds()))
