"""The API proxy reports a control-plane host in ``X-E2B-Alt-Used``.

Discovery is cached per API key and only applies when domain, api_url, and
sandbox_url are unset and debug is off.
"""

import re
from threading import Lock
from typing import Optional

ALT_USED_HEADER = "X-E2B-Alt-Used"

_resolved_domains: dict[str, str] = {}
_resolved_domains_lock = Lock()
_hostname_pattern = re.compile(
    r"^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$"
)


def get_resolved_domain(api_key: Optional[str] = None) -> Optional[str]:
    with _resolved_domains_lock:
        return _resolved_domains.get(api_key or "")


def record_resolved_domain(api_key: Optional[str], value: Optional[str]) -> None:
    if value is None:
        return

    resolved = value.strip().lower()
    if not resolved or not _hostname_pattern.fullmatch(resolved):
        return

    with _resolved_domains_lock:
        _resolved_domains[api_key or ""] = resolved


def clear_resolved_domains() -> None:
    with _resolved_domains_lock:
        _resolved_domains.clear()
