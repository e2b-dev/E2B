from typing import Any, Callable, Dict

import pytest

from e2b import InvalidArgumentException
from sdk_flavours import Sdk, result

# The generated API client writes a path parameter into the URL as it is, so an
# ID with a separator would name a different route. The tests read the request
# path off `backend`, a local server in place of the API.

NO_PATH_SEGMENT = ["", ".", ".."]


@pytest.mark.parametrize("sandbox_id", [*NO_PATH_SEGMENT, None])
async def test_kill_refuses_an_id_that_is_no_path_segment(
    sdk, backend, opts, sandbox_id
):
    with pytest.raises(InvalidArgumentException):
        await result(sdk.Sandbox.kill(sandbox_id, **opts))

    assert backend.sent == []


async def test_kill_keeps_a_slash_inside_the_id_segment(sdk, backend, opts):
    await result(sdk.Sandbox.kill("../templates/tpl123", **opts))

    assert backend.sent == ["DELETE /sandboxes/..%2Ftemplates%2Ftpl123"]


async def test_set_timeout_keeps_a_slash_inside_the_id_segment(sdk, backend, opts):
    await result(sdk.Sandbox.set_timeout("a/../b", 60, **opts))

    assert backend.sent == ["POST /sandboxes/a%2F..%2Fb/timeout"]


async def test_pause_keeps_a_slash_inside_the_id_segment(sdk, backend, opts):
    await result(sdk.Sandbox.pause("a/../b", **opts))

    assert backend.sent == ["POST /sandboxes/a%2F..%2Fb/pause"]


async def test_secret_destroy_keeps_a_slash_inside_the_name_segment(sdk, backend, opts):
    await result(sdk.Secret.destroy("../templates/tpl123", **opts))

    assert backend.sent == ["DELETE /secrets/..%2Ftemplates%2Ftpl123"]


ID_CALLS: Dict[str, Callable[[Sdk, str, Dict[str, Any]], Any]] = {
    "Volume.get_info": lambda sdk, name, opts: sdk.Volume.get_info(name, **opts),
    "Volume.connect": lambda sdk, name, opts: sdk.Volume.connect(name, **opts),
    "Volume.destroy": lambda sdk, name, opts: sdk.Volume.destroy(name, **opts),
    "Secret.get_info": lambda sdk, name, opts: sdk.Secret.get_info(name, **opts),
    "Secret.update": lambda sdk, name, opts: sdk.Secret.update(name, "v", **opts),
    "Secret.destroy": lambda sdk, name, opts: sdk.Secret.destroy(name, **opts),
}


@pytest.mark.parametrize("value", NO_PATH_SEGMENT)
@pytest.mark.parametrize("call", ID_CALLS.values(), ids=ID_CALLS.keys())
async def test_an_id_that_is_no_path_segment_is_refused(
    sdk, backend, opts, call, value
):
    with pytest.raises(InvalidArgumentException):
        await result(call(sdk, value, opts))

    assert backend.sent == []
