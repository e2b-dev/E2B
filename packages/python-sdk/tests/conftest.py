import asyncio
import os
import uuid
from typing import Callable, Optional
from uuid import uuid4

import pytest
import pytest_asyncio

from e2b import (
    AsyncCommandHandle,
    AsyncSandbox,
    AsyncTemplate,
    CommandExitException,
    CommandHandle,
    LogEntry,
    Sandbox,
    Template,
    TemplateClass,
)


@pytest.fixture(scope="session")
def sandbox_test_id():
    return f"test_{uuid.uuid4()}"


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def sandbox_factory(request, template, sandbox_test_id):
    def factory(*, template_name: str = template, **kwargs):
        kwargs.setdefault("secure", False)
        kwargs.setdefault("timeout", 5)

        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = Sandbox.create(template_name, **kwargs)

        request.addfinalizer(lambda: sandbox.kill())

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
        kwargs.setdefault("timeout", 5)

        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = await AsyncSandbox.create(template_name, **kwargs)

        def kill():
            async def _kill():
                await sandbox.kill()

            event_loop.run_until_complete(_kill())

        request.addfinalizer(kill)

        return sandbox

    return factory


@pytest.fixture
async def async_sandbox(async_sandbox_factory):
    return await async_sandbox_factory()


@pytest.fixture
def build():
    def _build(
        template: TemplateClass,
        alias: Optional[str] = None,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        return Template.build(
            template,
            alias=alias or f"e2b-test-{uuid4()}",
            cpu_count=1,
            memory_mb=1024,
            skip_cache=skip_cache,
            on_build_logs=on_build_logs,
        )

    return _build


@pytest_asyncio.fixture
def async_build():
    async def _async_build(
        template: TemplateClass,
        alias: Optional[str] = None,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        return await AsyncTemplate.build(
            template,
            alias=alias or f"e2b-test-{uuid4()}",
            cpu_count=1,
            memory_mb=1024,
            skip_cache=skip_cache,
            on_build_logs=on_build_logs,
        )

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
