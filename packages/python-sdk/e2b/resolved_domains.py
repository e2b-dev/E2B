"""X-E2B-Alt-Used identifies the key's control plane; api_url eligibility preserves rebuilt custom-proxy configs."""

import re
from threading import Lock
from typing import Optional

ALT_USED_HEADER = "X-E2B-Alt-Used"

_resolved_domains: dict[tuple[str, str], str] = {}
_resolved_domains_lock = Lock()
_hostname_pattern = re.compile(
    r"^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$"
)


def _cache_key(domain: str, api_key: Optional[str]) -> tuple[str, str]:
    return domain, api_key if api_key is not None else ""


def get_resolved_domain(domain: str, api_key: Optional[str] = None) -> Optional[str]:
    with _resolved_domains_lock:
        return _resolved_domains.get(_cache_key(domain, api_key))


def record_resolved_domain(
    domain: str, api_key: Optional[str], value: Optional[str]
) -> None:
    if value is None:
        return

    resolved = value.strip().lower()
    if not resolved or not _hostname_pattern.fullmatch(resolved) or resolved == domain:
        return

    with _resolved_domains_lock:
        _resolved_domains[_cache_key(domain, api_key)] = resolved


def uses_domain_api_url(domain: str, api_url: str, debug: bool) -> bool:
    return not debug and api_url == f"https://api.{domain}"


def clear_resolved_domains() -> None:
    with _resolved_domains_lock:
        _resolved_domains.clear()
