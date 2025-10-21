import asyncio
from typing import Callable, Optional
import uuid

import pytest
import pytest_asyncio
import os
from uuid import uuid4

from logging import warning

from e2b import (
    Sandbox,
    AsyncSandbox,
    AsyncCommandHandle,
    CommandExitException,
    CommandHandle,
    AsyncTemplate,
    Template,
    TemplateClass,
    LogEntry,
)


@pytest.fixture(scope="session")
def sandbox_test_id():
    return f"test_{uuid.uuid4()}"


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def sandbox(template, debug, sandbox_test_id):
    sandbox = Sandbox.create(template, metadata={"sandbox_test_id": sandbox_test_id})

    try:
        yield sandbox
    finally:
        try:
            sandbox.kill()
        except (Exception, RuntimeError):
            if not debug:
                warning(
                    "Failed to kill sandbox — this is expected if the test runs with local envd."
                )


@pytest_asyncio.fixture
async def async_sandbox(template, debug, sandbox_test_id):
    sandbox = await AsyncSandbox.create(
        template, metadata={"sandbox_test_id": sandbox_test_id}
    )

    try:
        yield sandbox
    finally:
        try:
            await sandbox.kill()
        except (Exception, RuntimeError):
            if not debug:
                warning(
                    "Failed to kill sandbox — this is expected if the test runs with local envd."
                )


@pytest.fixture
def build():
    def _build(
        template: TemplateClass,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        return Template.build(
            template,
            alias=f"e2b-test-{uuid4()}",
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
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ):
        return await AsyncTemplate.build(
            template,
            alias=f"e2b-test-{uuid4()}",
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
