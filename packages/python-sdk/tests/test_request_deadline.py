"""
The SDK's httpx clients run on pyqwest's httpx adapter, which has no per-phase
timeouts: it derives one whole-request deadline from a request's
``httpx.Timeout`` by adding up its ``read`` and ``write`` phases
(``pyqwest.httpx._transport.convert_timeout``). These tests pin the deadline the
adapter actually derives — not the ``httpx.Timeout`` fields — for each kind of
request the SDK makes: the control-plane API, envd's HTTP API, the volume content
API and template uploads. ``request_timeout=N`` must bound the request at N
seconds, not 2N (#1881).
"""

import io
from typing import List, Optional

import httpx
import pytest
from packaging.version import Version
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport
from pyqwest.httpx._transport import convert_timeout

from e2b import AsyncSandbox, AsyncVolume, Sandbox, Volume
from e2b.api.client.client import AuthenticatedClient
from e2b.api.client_async import get_envd_api as get_async_envd_api
from e2b.api.client_sync import get_envd_api as get_sync_envd_api
from e2b.connection_config import REQUEST_TIMEOUT, ConnectionConfig
from e2b.envd.api import (
    HEALTH_CHECK_TIMEOUT,
    acheck_sandbox_health,
    check_sandbox_health,
)
from e2b.template_async.build_api import upload_file as async_upload_file
from e2b.template_sync.build_api import upload_file as sync_upload_file

API_KEY = "e2b_" + "0" * 40


@pytest.fixture
def deadlines(monkeypatch) -> List[Optional[float]]:
    """Answer every request at the pyqwest adapter with a 599 and record the
    deadline the adapter derives for it."""
    recorded: List[Optional[float]] = []

    def handle_request(self, request):
        recorded.append(convert_timeout(request.extensions))
        return httpx.Response(599, request=request)

    async def handle_async_request(self, request):
        recorded.append(convert_timeout(request.extensions))
        return httpx.Response(599, request=request)

    monkeypatch.setattr(PyqwestTransport, "handle_request", handle_request)
    monkeypatch.setattr(
        AsyncPyqwestTransport, "handle_async_request", handle_async_request
    )
    return recorded


def _sandbox_opts(**config):
    return dict(
        sandbox_id="sbx",
        sandbox_domain="e2b.app",
        envd_version=Version("0.5.0"),
        envd_access_token=None,
        traffic_access_token=None,
        connection_config=ConnectionConfig(api_key=API_KEY, **config),
    )


def _sync_calls(tmp_path):
    sandbox = Sandbox(**_sandbox_opts())
    volume = Volume("vol", "name", token="vol-token")
    (tmp_path / "a.txt").write_text("a")
    return {
        "api": (
            lambda: Sandbox.get_info("sbx", api_key=API_KEY, request_timeout=2.5),
            2.5,
        ),
        "api default": (
            lambda: Sandbox.get_info("sbx", api_key=API_KEY),
            REQUEST_TIMEOUT,
        ),
        "envd read": (lambda: sandbox.files.read("/f", request_timeout=2.5), 2.5),
        "envd read stream": (
            lambda: sandbox.files.read("/f", format="stream", request_timeout=2.5),
            2.5,
        ),
        "envd write": (
            lambda: sandbox.files.write("/f", "data", request_timeout=2.5),
            2.5,
        ),
        "envd write multipart": (
            lambda: sandbox.files.write_files(
                [{"path": "/a", "data": "a"}, {"path": "/b", "data": "b"}],
                request_timeout=2.5,
            ),
            2.5,
        ),
        "envd is_running": (lambda: sandbox.is_running(request_timeout=2.5), 2.5),
        "envd health probe": (
            lambda: check_sandbox_health(
                get_sync_envd_api(
                    ConnectionConfig(api_key=API_KEY),
                    "http://sbx.test",
                    retry_connect=False,
                )
            ),
            HEALTH_CHECK_TIMEOUT,
        ),
        "volume read": (lambda: volume.read_file("/f", request_timeout=2.5), 2.5),
        "volume write": (
            lambda: volume.write_file("/f", "data", request_timeout=2.5),
            2.5,
        ),
        "template upload": (
            lambda: sync_upload_file(
                api_client=AuthenticatedClient(base_url="http://test", token="t"),
                file_name="*.txt",
                context_path=str(tmp_path),
                url="http://upload.test/archive",
                ignore_patterns=[],
                resolve_symlinks=False,
                gzip=True,
                stack_trace=None,
                request_timeout=2.5,
            ),
            2.5,
        ),
    }


def _async_calls(tmp_path):
    sandbox = AsyncSandbox(**_sandbox_opts())
    volume = AsyncVolume("vol", "name", token="vol-token")
    (tmp_path / "a.txt").write_text("a")
    return {
        "api": (
            lambda: AsyncSandbox.get_info("sbx", api_key=API_KEY, request_timeout=2.5),
            2.5,
        ),
        "api default": (
            lambda: AsyncSandbox.get_info("sbx", api_key=API_KEY),
            REQUEST_TIMEOUT,
        ),
        "envd read": (lambda: sandbox.files.read("/f", request_timeout=2.5), 2.5),
        "envd read stream": (
            lambda: sandbox.files.read("/f", format="stream", request_timeout=2.5),
            2.5,
        ),
        "envd write": (
            lambda: sandbox.files.write("/f", "data", request_timeout=2.5),
            2.5,
        ),
        "envd write multipart": (
            lambda: sandbox.files.write_files(
                [{"path": "/a", "data": "a"}, {"path": "/b", "data": "b"}],
                request_timeout=2.5,
            ),
            2.5,
        ),
        "envd is_running": (lambda: sandbox.is_running(request_timeout=2.5), 2.5),
        "envd health probe": (
            lambda: acheck_sandbox_health(
                get_async_envd_api(
                    ConnectionConfig(api_key=API_KEY),
                    "http://sbx.test",
                    retry_connect=False,
                )
            ),
            HEALTH_CHECK_TIMEOUT,
        ),
        "volume read": (lambda: volume.read_file("/f", request_timeout=2.5), 2.5),
        "volume write": (
            lambda: volume.write_file("/f", "data", request_timeout=2.5),
            2.5,
        ),
        "template upload": (
            lambda: async_upload_file(
                api_client=AuthenticatedClient(base_url="http://test", token="t"),
                file_name="*.txt",
                context_path=str(tmp_path),
                url="http://upload.test/archive",
                ignore_patterns=[],
                resolve_symlinks=False,
                gzip=True,
                stack_trace=None,
                request_timeout=2.5,
            ),
            2.5,
        ),
    }


CASES = [
    "api",
    "api default",
    "envd read",
    "envd read stream",
    "envd write",
    "envd write multipart",
    "envd is_running",
    "envd health probe",
    "volume read",
    "volume write",
    "template upload",
]


@pytest.mark.parametrize("case", CASES)
def test_sync_request_deadline_is_the_requested_timeout(case, deadlines, tmp_path):
    call, expected = _sync_calls(tmp_path)[case]
    try:
        call()
    except Exception:
        pass  # the stubbed 599 answer; only the deadline matters here

    assert deadlines, "the request never reached the transport"
    assert deadlines[0] == expected


@pytest.mark.parametrize("case", CASES)
async def test_async_request_deadline_is_the_requested_timeout(
    case, deadlines, tmp_path
):
    call, expected = _async_calls(tmp_path)[case]
    try:
        await call()
    except Exception:
        pass  # the stubbed 599 answer; only the deadline matters here

    assert deadlines, "the request never reached the transport"
    assert deadlines[0] == expected


def test_sync_disabled_and_streamed_requests_stay_unbounded(deadlines):
    # `request_timeout=0` disables the deadline, a streamed download without an
    # explicit `request_timeout` has none (an idle read bound applies instead),
    # and a streamed upload drops it — all unchanged.
    sandbox = Sandbox(**_sandbox_opts())
    for call in (
        lambda: Sandbox.get_info("sbx", api_key=API_KEY, request_timeout=0),
        lambda: sandbox.files.read("/f", format="stream"),
        lambda: sandbox.files.write("/f", io.BytesIO(b"data")),
    ):
        try:
            call()
        except Exception:
            pass

    assert deadlines == [None, None, None]


async def test_async_disabled_and_streamed_requests_stay_unbounded(deadlines):
    sandbox = AsyncSandbox(**_sandbox_opts())
    for call in (
        lambda: AsyncSandbox.get_info("sbx", api_key=API_KEY, request_timeout=0),
        lambda: sandbox.files.read("/f", format="stream"),
        lambda: sandbox.files.write("/f", io.BytesIO(b"data")),
    ):
        try:
            await call()
        except Exception:
            pass

    assert deadlines == [None, None, None]
