import os
import uuid
from typing import Callable, Optional

import pytest
from dotenv import load_dotenv
from e2b import Sandbox

from harness import AsyncCodeInterpreter, CodeInterpreter

load_dotenv()

DEFAULT_TEST_SANDBOX_TIMEOUT = 120
CODE_INTERPRETER_PORT = 49999
LOCAL_SERVER_URL = f"http://localhost:{CODE_INTERPRETER_PORT}"


def is_debug() -> bool:
    return os.getenv("E2B_DEBUG", "false").lower() == "true"


@pytest.fixture(scope="session")
def sandbox_test_id() -> str:
    return f"test_{uuid.uuid4()}"


@pytest.fixture(scope="session")
def template() -> str:
    return os.getenv("E2B_TESTS_TEMPLATE") or "code-interpreter-v1"


@pytest.fixture()
def sandbox_factory(
    request: pytest.FixtureRequest, template: str, sandbox_test_id: str
) -> Callable[..., Sandbox]:
    # Skip lazily, on use: the debug branches of `client`/`async_client`
    # depend on this fixture without ever calling it.
    def factory(
        *,
        timeout: int = DEFAULT_TEST_SANDBOX_TIMEOUT,
        envs: Optional[dict[str, str]] = None,
        allow_public_traffic: bool = True,
    ) -> Sandbox:
        if is_debug():
            pytest.skip("Sandbox provisioning is not available in debug mode")
        sandbox = Sandbox.create(
            template,
            timeout=timeout,
            metadata={"sandbox_test_id": sandbox_test_id},
            envs=envs,
            network={"allow_public_traffic": allow_public_traffic},
        )
        request.addfinalizer(sandbox.kill)
        return sandbox

    return factory


@pytest.fixture()
def sandbox(sandbox_factory) -> Sandbox:
    return sandbox_factory()


def code_interpreter_url(sandbox: Sandbox) -> str:
    scheme = "http" if sandbox.connection_config.debug else "https"
    return f"{scheme}://{sandbox.get_host(CODE_INTERPRETER_PORT)}"


def make_client(sandbox: Sandbox) -> CodeInterpreter:
    return CodeInterpreter(
        code_interpreter_url(sandbox),
        envd_access_token=sandbox._envd_access_token,
        traffic_access_token=sandbox.traffic_access_token,
    )


def make_async_client(sandbox: Sandbox) -> AsyncCodeInterpreter:
    return AsyncCodeInterpreter(
        code_interpreter_url(sandbox),
        envd_access_token=sandbox._envd_access_token,
        traffic_access_token=sandbox.traffic_access_token,
    )


@pytest.fixture()
def client_factory(request: pytest.FixtureRequest, sandbox_factory):
    def factory(**sandbox_kwargs) -> CodeInterpreter:
        client = make_client(sandbox_factory(**sandbox_kwargs))
        request.addfinalizer(client.close)
        return client

    return factory


@pytest.fixture()
def client(request: pytest.FixtureRequest, client_factory) -> CodeInterpreter:
    if is_debug():
        client = CodeInterpreter(LOCAL_SERVER_URL)
        request.addfinalizer(client.close)
        return client
    return client_factory()


@pytest.fixture()
async def async_client(request: pytest.FixtureRequest, sandbox_factory):
    if is_debug():
        client = AsyncCodeInterpreter(LOCAL_SERVER_URL)
    else:
        client = make_async_client(sandbox_factory())
    yield client
    await client.aclose()


@pytest.fixture(autouse=True)
def skip_debug(request: pytest.FixtureRequest):
    if request.node.get_closest_marker("skip_debug") and is_debug():
        pytest.skip("Skipped in debug mode")
