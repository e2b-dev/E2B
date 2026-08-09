from unittest.mock import MagicMock

import httpx
import pytest

from e2b.template.types import TemplateBuildStatus, TemplateBuildStatusResponse
from e2b.template_sync import build_api


def _ready_status() -> TemplateBuildStatusResponse:
    return TemplateBuildStatusResponse(
        build_id="build-id",
        template_id="template-id",
        status=TemplateBuildStatus.READY,
        log_entries=[],
        logs=[],
    )


def test_wait_for_build_finish_retries_transient_status_transport_error(
    monkeypatch,
) -> None:
    attempts = 0

    def get_status_once_after_transport_error(
        *_args, **_kwargs
    ) -> TemplateBuildStatusResponse:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.RemoteProtocolError("connection terminated")
        return _ready_status()

    monkeypatch.setattr(
        build_api, "get_build_status", get_status_once_after_transport_error
    )
    monkeypatch.setattr(build_api.time, "sleep", lambda _delay: None)

    build_api.wait_for_build_finish(MagicMock(), "template-id", "build-id")

    assert attempts == 2


def test_wait_for_build_finish_propagates_transport_error_after_retry_budget(
    monkeypatch,
) -> None:
    attempts = 0

    def always_raise_transport_error(*_args, **_kwargs) -> TemplateBuildStatusResponse:
        nonlocal attempts
        attempts += 1
        raise httpx.RemoteProtocolError("connection terminated")

    monkeypatch.setattr(build_api, "connection_retries", 1)
    monkeypatch.setattr(build_api, "get_build_status", always_raise_transport_error)
    monkeypatch.setattr(build_api.time, "sleep", lambda _delay: None)

    with pytest.raises(httpx.RemoteProtocolError):
        build_api.wait_for_build_finish(MagicMock(), "template-id", "build-id")

    assert attempts == 2
