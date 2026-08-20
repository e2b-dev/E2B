import asyncio
import os
import random
import string
from http import HTTPStatus
from typing import Callable, Dict, Optional
from uuid import uuid4

import attrs
import httpx
import pytest
import pytest_asyncio

import e2b.api.client.api.volumes.delete_volumes_volume_id as delete_volume_mod
import e2b.api.client.api.volumes.post_volumes as post_volumes_mod
import e2b.volume.volume_async as volume_async_mod
import e2b.volume.volume_sync as volume_sync_mod
from e2b.api.client.models.volume_and_token import VolumeAndToken
from e2b.api.client.types import Response
from mock_volume_content import MockVolumeContentAPI

from e2b import (
    AsyncCommandHandle,
    AsyncSandbox,
    AsyncTemplate,
    AsyncVolume,
    CommandExitException,
    CommandHandle,
    LogEntry,
    Sandbox,
    Template,
    TemplateClass,
    Volume,
)


@pytest.fixture
def test_api_key() -> str:
    """Placeholder API key with a valid format for tests that don't hit the API."""
    return "e2b_" + "0" * 40


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call":
        item._test_failed = rep.failed


@pytest.fixture()
def sandbox_test_id():
    return f"test_{_generate_random_string()}"


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def httpbin_template():
    """Template that serves go-httpbin on port 8080 — see `templates/httpbin`.

    Used as a sidecar by tests that need a publicly reachable echo server.
    """
    return "httpbin"


@pytest.fixture()
def sandbox_factory(request, template, sandbox_test_id):
    def factory(*, template_name: str = template, **kwargs):
        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = Sandbox.create(template_name, **kwargs)

        def finalizer():
            if getattr(request.node, "_test_failed", False):
                print(f"\n[TEST FAILED] Sandbox ID: {sandbox.sandbox_id}")
            sandbox.kill()

        request.addfinalizer(finalizer)

        return sandbox

    return factory


@pytest.fixture()
def sandbox(sandbox_factory):
    return sandbox_factory()


@pytest_asyncio.fixture
async def async_sandbox_factory(request, template, sandbox_test_id):
    sandboxes: list = []

    async def factory(*, template_name: str = template, **kwargs):
        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = await AsyncSandbox.create(template_name, **kwargs)
        sandboxes.append(sandbox)
        return sandbox

    yield factory

    if getattr(request.node, "_test_failed", False):
        for sandbox in sandboxes:
            print(f"\n[TEST FAILED] Sandbox ID: {sandbox.sandbox_id}")

    results = await asyncio.gather(
        *(sandbox.kill() for sandbox in sandboxes), return_exceptions=True
    )
    for sandbox, result in zip(sandboxes, results):
        if isinstance(result, BaseException):
            print(f"\n[TEARDOWN FAILED] Sandbox ID: {sandbox.sandbox_id}: {result!r}")


@pytest_asyncio.fixture
async def async_sandbox(async_sandbox_factory):
    return await async_sandbox_factory()


@pytest.fixture
def build():
    def _build(
        template: TemplateClass,
        name: Optional[str] = None,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        build_name = name or f"e2b-test-{_generate_random_string()}"
        build_info: Dict[str, Optional[str]] = {"template_id": None, "build_id": None}

        def capture_logs(log: LogEntry):
            import re

            if "Template created with ID:" in log.message:
                match = re.search(
                    r"Template created with ID: ([^,]+), Build ID: (.+)", log.message
                )
                if match:
                    build_info["template_id"] = match.group(1)
                    build_info["build_id"] = match.group(2)
            if on_build_logs:
                on_build_logs(log)

        try:
            return Template.build(
                template,
                build_name,
                cpu_count=1,
                memory_mb=1024,
                skip_cache=skip_cache,
                on_build_logs=capture_logs,
            )
        except Exception as e:
            print(
                f"\n[BUILD FAILED] name={build_name}, "
                f"template_id={build_info['template_id']}, "
                f"build_id={build_info['build_id']}, error={e}"
            )
            raise

    return _build


@pytest_asyncio.fixture
def async_build():
    async def _async_build(
        template: TemplateClass,
        name: Optional[str] = None,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        build_name = name or f"e2b-test-{_generate_random_string()}"
        build_info: Dict[str, Optional[str]] = {"template_id": None, "build_id": None}

        def capture_logs(log: LogEntry):
            import re

            if "Template created with ID:" in log.message:
                match = re.search(
                    r"Template created with ID: ([^,]+), Build ID: (.+)", log.message
                )
                if match:
                    build_info["template_id"] = match.group(1)
                    build_info["build_id"] = match.group(2)
            if on_build_logs:
                on_build_logs(log)

        try:
            return await AsyncTemplate.build(
                template,
                build_name,
                cpu_count=1,
                memory_mb=1024,
                skip_cache=skip_cache,
                on_build_logs=capture_logs,
            )
        except Exception as e:
            print(
                f"\n[BUILD FAILED] name={build_name}, "
                f"template_id={build_info['template_id']}, "
                f"build_id={build_info['build_id']}, error={e}"
            )
            raise

    return _async_build


@pytest.fixture
def debug():
    return os.getenv("E2B_DEBUG") is not None


@pytest.fixture(autouse=True)
def skip_by_debug(request, debug):
    if request.node.get_closest_marker("skip_debug"):
        if debug:
            pytest.skip("skipped because E2B_DEBUG is set")


class Helpers:
    @staticmethod
    def catch_cmd_exit_error_in_background(cmd: AsyncCommandHandle):
        disabled = False

        async def wait_for_exit():
            try:
                await cmd.wait()
            except CommandExitException as e:
                if not disabled:
                    assert False, (
                        f"command failed with exit code {e.exit_code}: {e.stderr}"
                    )

        asyncio.create_task(wait_for_exit())

        def disable():
            nonlocal disabled
            disabled = True

        return disable

    @staticmethod
    def check_cmd_exit_error(cmd: CommandHandle):
        try:
            cmd.wait()
        except CommandExitException as e:
            assert False, f"command failed with exit code {e.exit_code}: {e.stderr}"
        except Exception as e:
            raise e


@pytest.fixture
def helpers():
    return Helpers


def _generate_random_string(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def _mock_volume_transport(monkeypatch, module, transport: httpx.MockTransport):
    # The mock transport rides in `httpx_args` (an init field, rebuilt with
    # `attrs.evolve` rather than mutated) so it survives `with_timeout`.
    def wrap(real_factory):
        def factory(config, **kwargs):
            client = real_factory(config, **kwargs)
            return attrs.evolve(client, httpx_args={"transport": transport})

        return factory

    # Streamed reads run on their own client (the streaming transport), so
    # both factories need the mock transport.
    for name in ("get_volume_api_client", "get_streaming_volume_api_client"):
        monkeypatch.setattr(module, name, wrap(getattr(module, name)))


def _mock_volume_crud(monkeypatch, detailed_attr: str):
    """Mock the control-plane create/destroy calls the volume fixtures use."""

    def post_volumes(*, client, body):
        vol = VolumeAndToken(
            volume_id=str(uuid4()), name=body.name, token=f"vol-token-{uuid4()}"
        )
        return Response(
            status_code=HTTPStatus(201), content=b"", headers={}, parsed=vol
        )

    def delete_volume(volume_id, *, client):
        return Response(
            status_code=HTTPStatus(204), content=b"", headers={}, parsed=None
        )

    if detailed_attr == "asyncio_detailed":

        async def async_post_volumes(*, client, body):
            return post_volumes(client=client, body=body)

        async def async_delete_volume(volume_id, *, client):
            return delete_volume(volume_id, client=client)

        monkeypatch.setattr(post_volumes_mod, detailed_attr, async_post_volumes)
        monkeypatch.setattr(delete_volume_mod, detailed_attr, async_delete_volume)
    else:
        monkeypatch.setattr(post_volumes_mod, detailed_attr, post_volumes)
        monkeypatch.setattr(delete_volume_mod, detailed_attr, delete_volume)


@pytest.fixture
def volume(request, monkeypatch, test_api_key) -> Volume:
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    mock = MockVolumeContentAPI()
    _mock_volume_transport(
        monkeypatch, volume_sync_mod, httpx.MockTransport(mock.handler)
    )
    _mock_volume_crud(monkeypatch, "sync_detailed")
    vol = Volume.create(f"test-vol-{_generate_random_string()}")
    request.addfinalizer(lambda: Volume.destroy(vol.volume_id))
    return vol


@pytest_asyncio.fixture
async def async_volume(request, monkeypatch, test_api_key) -> AsyncVolume:
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    mock = MockVolumeContentAPI()
    _mock_volume_transport(
        monkeypatch, volume_async_mod, httpx.MockTransport(mock.async_handler)
    )
    _mock_volume_crud(monkeypatch, "asyncio_detailed")
    return await AsyncVolume.create(f"test-vol-{_generate_random_string()}")
