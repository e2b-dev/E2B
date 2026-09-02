import asyncio
import os
import uuid

import pytest

from e2b import SandboxException
from e2b_code_interpreter import (
    AsyncSandbox,
    Sandbox,
)


DEFAULT_TEST_SANDBOX_TIMEOUT = 180


@pytest.fixture(scope="session")
def sandbox_test_id():
    return f"test_{uuid.uuid4()}"


@pytest.fixture()
def template():
    return os.getenv("E2B_TESTS_TEMPLATE") or "code-interpreter-v1"


@pytest.fixture()
def sandbox_factory(request, template, sandbox_test_id):
    def factory(*, template_name: str = template, **kwargs):
        kwargs.setdefault("secure", False)
        kwargs.setdefault("timeout", DEFAULT_TEST_SANDBOX_TIMEOUT)

        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = Sandbox.create(template_name, **kwargs)

        request.addfinalizer(lambda: sandbox.kill())

        return sandbox

    return factory


@pytest.fixture()
def sandbox(sandbox_factory):
    return sandbox_factory()


@pytest.fixture
async def async_sandbox_factory(template, sandbox_test_id):
    sandboxes: list[AsyncSandbox] = []

    async def factory(*, template_name: str = template, **kwargs):
        kwargs.setdefault("timeout", DEFAULT_TEST_SANDBOX_TIMEOUT)

        metadata = kwargs.setdefault("metadata", dict())
        metadata.setdefault("sandbox_test_id", sandbox_test_id)

        sandbox = await AsyncSandbox.create(template_name, **kwargs)
        sandboxes.append(sandbox)
        return sandbox

    yield factory

    await asyncio.gather(
        *(sandbox.kill() for sandbox in sandboxes), return_exceptions=True
    )


@pytest.fixture
async def async_sandbox(async_sandbox_factory):
    return await async_sandbox_factory()


def _wait_for_java_kernel(sandbox: Sandbox) -> None:
    try:
        sandbox.run_code("1", language="java")
    except SandboxException as error:
        # A newly running sandbox can briefly return this response while Foxtrot
        # initializes Java. Retry only that known readiness failure; the test's
        # actual Java execution still runs exactly once.
        if str(error).strip() != "500:":
            raise

        sandbox.run_code("1", language="java")


async def _wait_for_java_kernel_async(sandbox: AsyncSandbox) -> None:
    try:
        await sandbox.run_code("1", language="java")
    except SandboxException as error:
        if str(error).strip() != "500:":
            raise

        await sandbox.run_code("1", language="java")


@pytest.fixture()
def wait_for_java_kernel():
    return _wait_for_java_kernel


@pytest.fixture()
def wait_for_java_kernel_async():
    return _wait_for_java_kernel_async


@pytest.fixture()
def java_sandbox(sandbox: Sandbox):
    _wait_for_java_kernel(sandbox)
    return sandbox


@pytest.fixture()
async def async_java_sandbox(async_sandbox: AsyncSandbox):
    await _wait_for_java_kernel_async(async_sandbox)
    return async_sandbox


@pytest.fixture
def debug():
    return os.getenv("E2B_DEBUG") is not None


@pytest.fixture(autouse=True)
def skip_by_debug(request, debug):
    if request.node.get_closest_marker("skip_debug"):
        if debug:
            pytest.skip("skipped because E2B_DEBUG is set")
