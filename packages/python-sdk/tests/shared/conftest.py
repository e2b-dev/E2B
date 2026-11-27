from typing import Any, Dict, Iterator

import pytest

from e2b import (
    AsyncSandbox,
    AsyncSecret,
    AsyncTemplate,
    AsyncVolume,
    Sandbox,
    Secret,
    Template,
    Volume,
)
from recording_backend import RecordingBackend, start_recording_backend
from sdk_flavours import Sdk, result


@pytest.fixture(params=["sync", "async"])
def sdk(request) -> Sdk:
    """Runs a test once against each flavour of the SDK."""
    if request.param == "sync":
        return Sdk(False, Sandbox, Secret, Template, Volume)
    return Sdk(True, AsyncSandbox, AsyncSecret, AsyncTemplate, AsyncVolume)


@pytest.fixture
def backend() -> Iterator[RecordingBackend]:
    """A local server in place of the E2B API and envd; see ``recording_backend``."""
    backend, stop = start_recording_backend()
    yield backend
    stop()


@pytest.fixture
def opts(backend, test_api_key) -> Dict[str, Any]:
    """Connection options that send every request to ``backend``."""
    return {
        "api_key": test_api_key,
        "api_url": backend.url,
        "sandbox_url": backend.url,
    }


@pytest.fixture
async def any_sandbox(sdk, backend, opts) -> Any:
    """A sandbox of either flavour that exists only in ``backend``'s answers."""
    sandbox = await result(sdk.Sandbox.create(**opts))
    backend.requests.clear()
    return sandbox
