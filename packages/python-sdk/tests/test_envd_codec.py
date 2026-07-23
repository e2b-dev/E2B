"""The envd JSON codec (client_shared) decodes responses leniently — unknown
fields from a newer envd must not break an older SDK — and classifies decode
failures at the source: it raises ``ConnectError(INTERNAL)`` itself rather
than letting the raw error escape into connectrpc's catch-all, which would
wrap it as ``ConnectError(UNAVAILABLE)`` and map to a misleading
sandbox-timeout message in rpc.py.
"""

import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b.envd.client_shared import ENVD_JSON_CODEC
from e2b.envd.process.process_pb import ProcessConfig
from e2b.envd.rpc import handle_rpc_exception, is_transport_failure
from e2b.exceptions import SandboxException, TimeoutException


def test_decodes_and_ignores_unknown_fields():
    config = ENVD_JSON_CODEC.decode(
        b'{"cmd": "echo", "notYetInThisSdk": true}', ProcessConfig
    )
    assert config.cmd == "echo"


def test_decode_failure_raises_typed_connect_error():
    with pytest.raises(ConnectError) as excinfo:
        ENVD_JSON_CODEC.decode(b"<html>not json</html>", ProcessConfig)
    assert excinfo.value.code is Code.INTERNAL
    assert "ProcessConfig" in excinfo.value.message
    assert isinstance(excinfo.value.__cause__, Exception)


def test_decode_failure_maps_to_sandbox_exception_not_timeout():
    # INTERNAL has no special mapping in rpc.py: the codec's message surfaces
    # in a SandboxException, never the sandbox-timeout TimeoutException that
    # connectrpc's UNAVAILABLE catch-all wrapping would have produced — and
    # no sandbox health probe runs for it.
    with pytest.raises(ConnectError) as excinfo:
        ENVD_JSON_CODEC.decode(b"not json", ProcessConfig)
    assert not is_transport_failure(excinfo.value)
    err = handle_rpc_exception(excinfo.value)
    assert isinstance(err, SandboxException)
    assert not isinstance(err, TimeoutException)
    assert "could not be decoded" in str(err)
