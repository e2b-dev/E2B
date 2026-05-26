from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional


def parse_retry_after(retry_after_header: Optional[str]) -> Optional[int]:
    if not retry_after_header:
        return None

    try:
        retry_after = int(retry_after_header)
        return max(retry_after, 0)
    except ValueError:
        pass

    try:
        retry_at = parsedate_to_datetime(retry_after_header)
    except (TypeError, ValueError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)

    return max(int((retry_at - datetime.now(timezone.utc)).total_seconds()), 0)


def append_retry_after(message: str, retry_after: Optional[int]) -> str:
    if retry_after is None:
        return message
    return f"{message} Retry after {retry_after} seconds."
