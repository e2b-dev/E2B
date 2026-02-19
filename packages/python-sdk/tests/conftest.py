import asyncio
import os
import random
import string
from typing import Callable, Dict, Optional

import pytest
import pytest_asyncio

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


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when == "call":
        item._test_failed = rep.failed


@pytest.fixture(scope="session")
def sandbox_test_id():
    return f"test_{_generate_random_string()}"


@pytest.fixture()
def template():
    return "base"


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


# override the event loop so it never closes
# this helps us with the global-scoped async http transport
@pytest.fixture(scope="session")
def event_loop():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def async_sandbox_factory(request, template, sandbox_test_id, event_loop):
    async def factory(*, template_name: str = template, **kwargs):
        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = await AsyncSandbox.create(template_name, **kwargs)

        def finalizer():
            if getattr(request.node, "_test_failed", False):
                print(f"\n[TEST FAILED] Sandbox ID: {sandbox.sandbox_id}")

            async def _kill():
                await sandbox.kill()

            event_loop.run_until_complete(_kill())

        request.addfinalizer(finalizer)

        return sandbox

    return factory


@pytest.fixture
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
            pytest.skip(
                "skipped because E2B_DEBUG is set"  # ty: ignore[too-many-positional-arguments]
            )  # ty: ignore[invalid-argument-type]


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


@pytest.fixture
def volume(request):
    vol = Volume.create(f"test-vol-{_generate_random_string()}")

    def finalizer():
        if getattr(request.node, "_test_failed", False):
            print(f"\n[TEST FAILED] Volume ID: {vol.volume_id}")
        try:
            Volume.destroy(vol.volume_id)
        except Exception:
            pass

    request.addfinalizer(finalizer)
    return vol


@pytest.fixture
async def async_volume(request, event_loop):
    vol = await AsyncVolume.create(f"test-vol-{_generate_random_string()}")

    def finalizer():
        if getattr(request.node, "_test_failed", False):
            print(f"\n[TEST FAILED] Volume ID: {vol.volume_id}")

        async def _destroy():
            try:
                await AsyncVolume.destroy(vol.volume_id)
            except Exception:
                pass

        event_loop.run_until_complete(_destroy())

    request.addfinalizer(finalizer)
    return vol
