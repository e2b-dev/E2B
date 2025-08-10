import asyncio
import uuid

import pytest
import pytest_asyncio
import os

from logging import warning

from e2b import (
    Sandbox,
    AsyncSandbox,
    AsyncCommandHandle,
    CommandExitException,
    CommandHandle,
)


@pytest.fixture(scope="session")
def sandbox_type():
    return f"test_{uuid.uuid4()}"


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def sandbox(template, debug, sandbox_type):
    sandbox = Sandbox(template, metadata={"sandbox_type": sandbox_type})

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
async def async_sandbox(template, debug, sandbox_type):
    sandbox = await AsyncSandbox.create(
        template, metadata={"sandbox_type": sandbox_type}
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
                    assert (
                        False
                    ), f"command failed with exit code {e.exit_code}: {e.stderr}"

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
