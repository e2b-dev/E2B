"""The `ca_bundle` connection option: a PEM file of CA certificates trusted —
on top of the system store — by every transport the SDK builds."""

import ssl
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import httpx
import pytest
import trustme

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
import e2b.envd.client_async as envd_client_async
import e2b.envd.client_sync as envd_client_sync
import e2b.volume.client_async as volume_client_async
import e2b.volume.client_sync as volume_client_sync
from e2b.api import ProxyConfig, TransportConfig, load_ca_bundle
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import FileUploadException, InvalidArgumentException
from e2b.template_async.build_api import upload_file as upload_file_async
from e2b.template_sync.build_api import upload_file as upload_file_sync
from e2b.volume.connection_config import VolumeConnectionConfig


@pytest.fixture(scope="module")
def ca() -> trustme.CA:
    return trustme.CA()


@pytest.fixture(scope="module")
def ca_bundle(ca: trustme.CA, tmp_path_factory) -> str:
    """The CA certificate as a PEM file, the way `ca_bundle` takes it."""
    path = tmp_path_factory.mktemp("tls") / "ca.pem"
    ca.cert_pem.write_to_path(str(path))
    return str(path)


class _TlsHandler(BaseHTTPRequestHandler):
    """Answers every request with a 200 and the request method as the body."""

    def _respond(self):
        body = self.command.encode()
        # Drain a request body (the build-context upload) before answering.
        length = int(self.headers.get("Content-Length", 0))
        if length:
            self.rfile.read(length)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = _respond
    do_PUT = _respond

    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def tls_server(ca: trustme.CA):
    """An HTTPS server whose certificate only the test CA vouches for, so a
    request to it succeeds exactly when `ca_bundle` reached the transport."""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    # `PROTOCOL_TLS_SERVER` alone would still offer TLS 1.0/1.1, which reqwest
    # refuses to negotiate anyway.
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    ca.issue_cert("localhost", "127.0.0.1").configure_cert(context)

    server = ThreadingHTTPServer(("127.0.0.1", 0), _TlsHandler)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"https://localhost:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join()


@pytest.fixture(autouse=True)
def reset_transports():
    """The transport caches are process-global; a test that builds one for a
    fresh CA bundle must not hand it to the next."""
    yield
    for module in (
        api_client_sync,
        api_client_async,
        envd_client_sync,
        envd_client_async,
        volume_client_sync,
        volume_client_async,
    ):
        module._transports.clear()
    api_client_sync._envd_transports.clear()
    api_client_async._envd_transports.clear()


def test_ca_bundle_defaults_to_env_var(monkeypatch, ca_bundle):
    monkeypatch.setenv("E2B_CA_BUNDLE", ca_bundle)

    assert ConnectionConfig().ca_bundle == ca_bundle
    assert VolumeConnectionConfig().ca_bundle == ca_bundle
    # An explicit option still wins over the environment.
    assert ConnectionConfig(ca_bundle="/other/ca.pem").ca_bundle == "/other/ca.pem"
    assert (
        VolumeConnectionConfig(ca_bundle="/other/ca.pem").ca_bundle == "/other/ca.pem"
    )


def test_ca_bundle_defaults_to_none(monkeypatch):
    monkeypatch.delenv("E2B_CA_BUNDLE", raising=False)

    assert ConnectionConfig().ca_bundle is None
    assert VolumeConnectionConfig().ca_bundle is None


def test_ca_bundle_propagates_through_api_params(ca_bundle):
    config = ConnectionConfig(ca_bundle=ca_bundle)

    assert config.get_api_params()["ca_bundle"] == ca_bundle
    assert (
        config.get_api_params(ca_bundle="/other/ca.pem")["ca_bundle"] == "/other/ca.pem"
    )


def test_load_ca_bundle_reads_the_file(ca_bundle):
    pem = load_ca_bundle(ca_bundle)

    assert isinstance(pem, bytes)
    assert pem == Path(ca_bundle).read_bytes()
    assert load_ca_bundle(None) is None


def test_load_ca_bundle_rejects_a_missing_file(tmp_path):
    missing = str(tmp_path / "nope.pem")

    with pytest.raises(InvalidArgumentException, match="Could not read the CA bundle"):
        load_ca_bundle(missing)


def test_load_ca_bundle_rejects_a_file_without_a_certificate(tmp_path):
    not_pem = tmp_path / "ca.der"
    not_pem.write_bytes(b"\x30\x82not a pem")

    with pytest.raises(InvalidArgumentException, match="no PEM certificate"):
        load_ca_bundle(str(not_pem))


def test_unreadable_ca_bundle_surfaces_when_the_transport_is_built(tmp_path):
    config = ConnectionConfig(
        api_key="e2b_" + "0" * 40, ca_bundle=str(tmp_path / "nope.pem")
    )

    with pytest.raises(InvalidArgumentException, match="Could not read the CA bundle"):
        api_client_sync.get_transport(config)


def test_verify_ssl_is_rejected(test_api_key, ca_bundle):
    # httpx's `verify` never reaches a pyqwest transport, so accepting it would
    # silently leave TLS trust unconfigured.
    with pytest.raises(InvalidArgumentException, match="`ca_bundle`"):
        api_client_sync.get_api_client(
            ConnectionConfig(api_key=test_api_key), verify_ssl=ca_bundle
        )

    with pytest.raises(InvalidArgumentException, match="`ca_bundle`"):
        volume_client_sync.get_api_client(
            VolumeConnectionConfig(token="tok"), verify_ssl=ca_bundle
        )

    with pytest.raises(InvalidArgumentException, match="`ca_bundle`"):
        volume_client_async.get_api_client(
            VolumeConnectionConfig(token="tok"), verify_ssl=ca_bundle
        )

    # The generated default means "nothing configured" and passes through.
    api_client_sync.get_api_client(
        ConnectionConfig(api_key=test_api_key), verify_ssl=True
    )


def test_transports_are_keyed_by_ca_bundle(test_api_key, ca_bundle, tmp_path):
    other_bundle = tmp_path / "other-ca.pem"
    other_bundle.write_bytes(Path(ca_bundle).read_bytes())

    default = ConnectionConfig(api_key=test_api_key)
    trusting = ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
    trusting_other = ConnectionConfig(api_key=test_api_key, ca_bundle=str(other_bundle))

    for get_transport in (
        api_client_sync.get_transport,
        api_client_async.get_transport,
        api_client_sync.get_envd_transport,
        api_client_async.get_envd_transport,
    ):
        assert get_transport(trusting) is not get_transport(default)
        assert get_transport(trusting) is not get_transport(trusting_other)
        # The same bundle keeps sharing one connection pool.
        assert get_transport(trusting) is get_transport(
            ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
        )

    volume_default = VolumeConnectionConfig(token="tok")
    volume_trusting = VolumeConnectionConfig(token="tok", ca_bundle=ca_bundle)

    for get_transport in (
        volume_client_sync.get_transport,
        volume_client_sync.get_streaming_transport,
        volume_client_async.get_transport,
        volume_client_async.get_streaming_transport,
    ):
        assert get_transport(volume_trusting) is not get_transport(volume_default)
        assert get_transport(volume_trusting) is get_transport(
            VolumeConnectionConfig(token="tok", ca_bundle=ca_bundle)
        )

    envd_trusting = TransportConfig.from_config(trusting)
    envd_proxied = TransportConfig(
        ProxyConfig("http://127.0.0.1:8080"), ca_bundle=ca_bundle
    )
    for get_transport in (
        envd_client_sync.get_transport,
        envd_client_async.get_transport,
    ):
        assert get_transport(envd_trusting) is not get_transport(TransportConfig())
        assert get_transport(envd_trusting) is not get_transport(envd_proxied)
        assert get_transport(envd_trusting) is get_transport(
            TransportConfig.from_config(trusting)
        )


def test_sync_api_client_trusts_the_ca_bundle(test_api_key, tls_server, ca_bundle):
    untrusting = api_client_sync.get_api_client(
        ConnectionConfig(api_key=test_api_key, api_url=tls_server)
    ).get_httpx_client()
    trusting = api_client_sync.get_api_client(
        ConnectionConfig(api_key=test_api_key, api_url=tls_server, ca_bundle=ca_bundle)
    ).get_httpx_client()

    try:
        with pytest.raises(httpx.ConnectError):
            untrusting.get("/sandboxes")

        assert trusting.get("/sandboxes").status_code == 200
    finally:
        untrusting.close()
        trusting.close()


async def test_async_api_client_trusts_the_ca_bundle(
    test_api_key, tls_server, ca_bundle
):
    untrusting = api_client_async.get_api_client(
        ConnectionConfig(api_key=test_api_key, api_url=tls_server)
    ).get_async_httpx_client()
    trusting = api_client_async.get_api_client(
        ConnectionConfig(api_key=test_api_key, api_url=tls_server, ca_bundle=ca_bundle)
    ).get_async_httpx_client()

    try:
        with pytest.raises(httpx.ConnectError):
            await untrusting.get("/sandboxes")

        assert (await trusting.get("/sandboxes")).status_code == 200
    finally:
        await untrusting.aclose()
        await trusting.aclose()


@pytest.mark.parametrize("for_streaming", [False, True])
def test_sync_envd_api_trusts_the_ca_bundle(
    test_api_key, tls_server, ca_bundle, for_streaming
):
    config = ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
    client = api_client_sync.get_envd_api(
        config, tls_server, for_streaming=for_streaming
    )

    try:
        assert client.get("/health").status_code == 200
    finally:
        client.close()


async def test_async_envd_api_trusts_the_ca_bundle(test_api_key, tls_server, ca_bundle):
    config = ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
    client = api_client_async.get_envd_api(config, tls_server)

    try:
        assert (await client.get("/health")).status_code == 200
    finally:
        await client.aclose()


def test_sync_envd_rpc_transport_trusts_the_ca_bundle(tls_server, ca_bundle):
    from pyqwest import SyncRequest

    transport = envd_client_sync.get_transport(
        TransportConfig.from_config(ConnectionConfig(ca_bundle=ca_bundle))
    )

    response = transport.execute_sync(SyncRequest(method="GET", url=tls_server))
    assert response.status == 200


async def test_async_envd_rpc_transport_trusts_the_ca_bundle(tls_server, ca_bundle):
    from pyqwest import Request

    transport = envd_client_async.get_transport(
        TransportConfig.from_config(ConnectionConfig(ca_bundle=ca_bundle))
    )

    response = await transport.execute(Request(method="GET", url=tls_server))
    assert response.status == 200


def test_sync_volume_client_trusts_the_ca_bundle(tls_server, ca_bundle):
    untrusting = volume_client_sync.get_api_client(
        VolumeConnectionConfig(token="tok", api_url=tls_server)
    ).get_httpx_client()
    trusting = volume_client_sync.get_api_client(
        VolumeConnectionConfig(token="tok", api_url=tls_server, ca_bundle=ca_bundle)
    ).get_httpx_client()
    streaming = volume_client_sync.get_streaming_api_client(
        VolumeConnectionConfig(token="tok", api_url=tls_server, ca_bundle=ca_bundle)
    ).get_httpx_client()

    try:
        with pytest.raises(httpx.ConnectError):
            untrusting.get("/volumes")

        assert trusting.get("/volumes").status_code == 200
        assert streaming.get("/volumes").status_code == 200
    finally:
        untrusting.close()
        trusting.close()
        streaming.close()


async def test_async_volume_client_trusts_the_ca_bundle(tls_server, ca_bundle):
    trusting = volume_client_async.get_api_client(
        VolumeConnectionConfig(token="tok", api_url=tls_server, ca_bundle=ca_bundle)
    ).get_async_httpx_client()
    streaming = volume_client_async.get_streaming_api_client(
        VolumeConnectionConfig(token="tok", api_url=tls_server, ca_bundle=ca_bundle)
    ).get_async_httpx_client()

    try:
        assert (await trusting.get("/volumes")).status_code == 200
        assert (await streaming.get("/volumes")).status_code == 200
    finally:
        await trusting.aclose()
        await streaming.aclose()


@pytest.fixture
def build_context(tmp_path) -> str:
    (tmp_path / "Dockerfile").write_text("FROM scratch\n")
    return str(tmp_path)


def test_sync_template_upload_trusts_the_ca_bundle(
    test_api_key, tls_server, ca_bundle, build_context
):
    # The upload builds its own client from the API client's connection
    # options, so a CA bundle configured for the build has to reach it too.
    api_client = api_client_sync.get_api_client(
        ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
    )
    untrusting_client = api_client_sync.get_api_client(
        ConnectionConfig(api_key=test_api_key)
    )

    upload_file_sync(
        api_client,
        "Dockerfile",
        build_context,
        f"{tls_server}/upload",
        [],
        False,
        False,
        None,
    )

    with pytest.raises(FileUploadException):
        upload_file_sync(
            untrusting_client,
            "Dockerfile",
            build_context,
            f"{tls_server}/upload",
            [],
            False,
            False,
            None,
        )


async def test_async_template_upload_trusts_the_ca_bundle(
    test_api_key, tls_server, ca_bundle, build_context
):
    api_client = api_client_async.get_api_client(
        ConnectionConfig(api_key=test_api_key, ca_bundle=ca_bundle)
    )
    untrusting_client = api_client_async.get_api_client(
        ConnectionConfig(api_key=test_api_key)
    )

    await upload_file_async(
        api_client,
        "Dockerfile",
        build_context,
        f"{tls_server}/upload",
        [],
        False,
        False,
        None,
    )

    with pytest.raises(FileUploadException):
        await upload_file_async(
            untrusting_client,
            "Dockerfile",
            build_context,
            f"{tls_server}/upload",
            [],
            False,
            False,
            None,
        )
