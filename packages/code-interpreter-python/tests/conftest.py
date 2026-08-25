import asyncio
import os

import pytest

from e2b_code_interpreter import (
    AsyncSandbox,
    Sandbox,
)
import uuid


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
        kwargs.setdefault("timeout", 60)

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
        kwargs.setdefault("timeout", 60)

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


@pytest.fixture
def debug():
    return os.getenv("E2B_DEBUG") is not None


@pytest.fixture(autouse=True)
def skip_by_debug(request, debug):
    if request.node.get_closest_marker("skip_debug"):
        if debug:
            pytest.skip("skipped because E2B_DEBUG is set")
