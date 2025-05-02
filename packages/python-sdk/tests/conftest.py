import asyncio

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


@pytest.fixture()
def template():
    return "base"


@pytest.fixture()
def sandbox(template, debug):
    sandbox = Sandbox(template)

    try:
        yield sandbox
    finally:
        try:
            sandbox.kill()
        except:
            if not debug:
                warning(
                    "Failed to kill sandbox — this is expected if the test runs with local envd."
                )


@pytest_asyncio.fixture
async def async_sandbox(template, debug):
    sandbox = await AsyncSandbox.create(template)

    try:
        yield sandbox
    finally:
        try:
            await sandbox.kill()
        except:
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
    def wait_for_async_failure(cmd: AsyncCommandHandle):
        disabled = False

        async def wait_for_failure():
            try:
                await cmd.wait()
            except CommandExitException as e:
                if not disabled:
                    assert (
                        False
                    ), f"command failed with exit code {e.exit_code}: {e.stderr}"

        asyncio.create_task(wait_for_failure())

        def disable():
            nonlocal disabled
            disabled = True

        return disable

    @staticmethod
    def wait_for_failure(cmd: CommandHandle):
        try:
            cmd.wait()
        except CommandExitException as e:
            assert False, f"command failed with exit code {e.exit_code}: {e.stderr}"
        except Exception as e:
            raise e


@pytest.fixture
def helpers():
    return Helpers
