import os
from logging import warning
import uuid

import pytest
import pytest_asyncio
from e2b import AsyncSandbox, Sandbox


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
        sandbox_id = sandbox.pause()
        sandbox.resume(sandbox_id)
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
async def async_sandbox(template, debug, sandbox_type):
    sandbox = await AsyncSandbox.create(template, metadata={"sandbox_type": sandbox_type})

    try:
        sandbox_id = await sandbox.pause()
        await sandbox.resume(sandbox_id)
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
