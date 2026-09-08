from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox.main import SandboxBase


def _sandbox(debug: bool) -> SandboxBase:
    return SandboxBase(
        sandbox_id="abc123",
        envd_version=Version("0.1.0"),
        envd_access_token=None,
        sandbox_domain="e2b.app",
        connection_config=ConnectionConfig(domain="e2b.app", debug=debug),
    )


def test_get_grpc_target_uses_tls_port_443():
    assert _sandbox(debug=False).get_grpc_target(50051) == "50051-abc123.e2b.app:443"


def test_get_grpc_target_debug_is_localhost():
    assert _sandbox(debug=True).get_grpc_target(50051) == "localhost:50051"
