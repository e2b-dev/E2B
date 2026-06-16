import time
import urllib.parse

import pytest
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.main import SandboxBase
from e2b.sandbox.signature import get_signature


def create_sandbox(envd_access_token=None):
    return SandboxBase(
        sandbox_id="sandbox-id",
        sandbox_domain="e2b.app",
        envd_version=Version("0.4.0"),
        envd_access_token=envd_access_token,
        traffic_access_token=None,
        connection_config=ConnectionConfig(domain="e2b.app"),
    )


def test_file_urls_use_direct_sandbox_host_when_envd_api_uses_stable_host():
    sandbox = create_sandbox()

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


def test_file_urls_raise_when_signature_expiration_used_on_unsecured_sandbox():
    sandbox = create_sandbox(envd_access_token=None)

    with pytest.raises(
        InvalidArgumentException,
        match="Signature expiration can be used only when sandbox is created as secured.",
    ):
        sandbox.download_url("/tmp/a.txt", use_signature_expiration=120)

    with pytest.raises(
        InvalidArgumentException,
        match="Signature expiration can be used only when sandbox is created as secured.",
    ):
        sandbox.upload_url("/tmp/a.txt", use_signature_expiration=120)


def test_zero_signature_expiration_expires_immediately():
    before = int(time.time())
    signature = get_signature("/tmp/a.txt", "read", "user", "access-token", 0)
    after = int(time.time())

    assert signature["expiration"] is not None
    assert before <= signature["expiration"] <= after


def test_zero_signature_expiration_is_included_in_url():
    sandbox = create_sandbox(envd_access_token="access-token")

    for url in (
        sandbox.download_url("/tmp/a.txt", use_signature_expiration=0),
        sandbox.upload_url("/tmp/a.txt", use_signature_expiration=0),
    ):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        assert "signature_expiration" in query
