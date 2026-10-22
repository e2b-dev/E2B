"""The proxy reports an API key's control plane in ``X-E2B-Alt-Used``.

Eligibility compares ``api_url`` because rebuilt configs carry it; setting
E2B_DOMAIN, E2B_API_URL, E2B_SANDBOX_URL, or E2B_VOLUME_API_URL disables
discovery.
"""

import os
import re
from threading import Lock
from typing import Optional

ALT_USED_HEADER = "X-E2B-Alt-Used"

_resolved_domains: dict[tuple[str, str], str] = {}
_resolved_domains_lock = Lock()
_PINNED_ENV_VARS = (
    "E2B_DOMAIN",
    "E2B_API_URL",
    "E2B_SANDBOX_URL",
    "E2B_VOLUME_API_URL",
)
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
    return (
        not debug
        and not any(os.getenv(name) for name in _PINNED_ENV_VARS)
        and api_url == f"https://api.{domain}"
    )


def clear_resolved_domains() -> None:
    with _resolved_domains_lock:
        _resolved_domains.clear()
