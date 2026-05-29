from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox.main import SandboxBase


def test_file_urls_use_direct_sandbox_host_when_envd_api_uses_stable_host():
    sandbox = SandboxBase(
        sandbox_id="sandbox-id",
        sandbox_domain="e2b.app",
        envd_version=Version("0.4.0"),
        envd_access_token=None,
        traffic_access_token=None,
        connection_config=ConnectionConfig(domain="e2b.app"),
    )

    assert sandbox.envd_api_url == "https://sandbox.e2b.app"
    assert sandbox.envd_direct_url == "https://49983-sandbox-id.e2b.app"
    assert (
        sandbox.download_url("/tmp/a.txt")
        == "https://49983-sandbox-id.e2b.app/files?path=%2Ftmp%2Fa.txt"
    )
    assert (
        sandbox.upload_url("/tmp/a.txt")
        == "https://49983-sandbox-id.e2b.app/files?path=%2Ftmp%2Fa.txt"
    )
