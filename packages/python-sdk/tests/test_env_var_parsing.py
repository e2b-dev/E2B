"""Numeric E2B_* env vars are parsed at import time; an empty-string value
(e.g. `E2B_KEEPALIVE_EXPIRY=` in a dotenv file) must fall back to the default
instead of raising ValueError when the module is imported."""

import importlib

import e2b.api

_ENV_VARS = (
    "E2B_KEEPALIVE_EXPIRY",
    "E2B_MAX_KEEPALIVE_CONNECTIONS",
    "E2B_CONNECTION_RETRIES",
    "E2B_ENVD_POOL_SHARDS",
)


def _reload():
    return importlib.reload(e2b.api)


def test_empty_env_vars_fall_back_to_defaults(monkeypatch):
    for var in _ENV_VARS:
        monkeypatch.setenv(var, "")
    try:
        api = _reload()
        assert api.pool_idle_timeout == 300
        assert api.pool_max_idle_per_host == 20
        assert api.connection_retries == 3
        assert api.envd_pool_shards == 4
    finally:
        monkeypatch.undo()
        _reload()


def test_set_env_vars_are_honored(monkeypatch):
    monkeypatch.setenv("E2B_KEEPALIVE_EXPIRY", "42")
    monkeypatch.setenv("E2B_CONNECTION_RETRIES", "5")
    monkeypatch.setenv("E2B_ENVD_POOL_SHARDS", "8")
    try:
        api = _reload()
        assert api.pool_idle_timeout == 42
        assert api.connection_retries == 5
        assert api.envd_pool_shards == 8
    finally:
        monkeypatch.undo()
        _reload()
