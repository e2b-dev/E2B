"""
CLI configuration module for reading credentials from the E2B CLI config file.
"""

import json
from pathlib import Path
from typing import Optional, TypedDict


class CLIConfig(TypedDict, total=False):
    """User configuration stored by the E2B CLI in ~/.e2b/config.json"""

    email: str
    accessToken: str
    teamName: str
    teamId: str
    teamApiKey: str
    dockerProxySet: bool


_cached_config: Optional[CLIConfig] = None
_config_loaded: bool = False


def get_cli_config_path() -> Path:
    """Get the path to the CLI config file."""
    return Path.home() / ".e2b" / "config.json"


def get_cli_config() -> Optional[CLIConfig]:
    """
    Read the CLI configuration from ~/.e2b/config.json if it exists.

    This is used as a fallback when API key or access token is not provided
    directly or via environment variables.

    Returns:
        The CLI configuration or None if not available.
    """
    global _cached_config, _config_loaded

    if _config_loaded:
        return _cached_config

    _config_loaded = True

    config_path = get_cli_config_path()
    if not config_path.exists():
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            _cached_config = json.load(f)
            return _cached_config
    except (json.JSONDecodeError, IOError, OSError):
        return None


def clear_cli_config_cache() -> None:
    """
    Clear the cached CLI configuration.

    This is primarily used for testing purposes.
    """
    global _cached_config, _config_loaded
    _cached_config = None
    _config_loaded = False
