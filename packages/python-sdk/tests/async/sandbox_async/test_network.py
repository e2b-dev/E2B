import asyncio
import json

import httpx
import pytest

from e2b import SandboxNetworkOpts
from e2b.sandbox.commands.command_handle import CommandExitException


async def wait_for_status(
    client: httpx.AsyncClient,
    url: str,
    status_code: int,
    headers: dict[str, str] | None = None,
    timeout: float = 15,
) -> httpx.Response:
    deadline = asyncio.get_running_loop().time() + timeout
    response: httpx.Response | None = None

    while asyncio.get_running_loop().time() < deadline:
        response = await client.get(url, headers=headers, follow_redirects=True)
        if response.status_code == status_code:
            return response
        await asyncio.sleep(1)

    assert response is not None
    return response


@pytest.mark.skip_debug()
async def test_allow_specific_ip_with_deny_all(async_sandbox_factory):
    """Test that sandbox with denyOut all and allowOut creates a whitelist."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic], allow_out=["1.1.1.1"]
        )
    )

    # Test that allowed IP works
    result = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "301"

    # Test that other IPs are denied
    with pytest.raises(CommandExitException) as exc_info:
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
async def test_deny_specific_ip(async_sandbox_factory):
    """Test that sandbox with denyOut denies specified IP addresses."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(deny_out=["8.8.8.8"])
    )

    # Test that denied IP fails
    with pytest.raises(CommandExitException) as exc_info:
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0

    # Test that other IPs work
    result = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "301"


@pytest.mark.skip_debug()
async def test_deny_all_traffic(async_sandbox_factory):
    """Test that sandbox can deny all traffic using the all_traffic selector."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(deny_out=lambda ctx: [ctx.all_traffic]), timeout=30
    )

    # Test that all traffic is denied
    with pytest.raises(CommandExitException) as exc_info:
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://1.1.1.1"
        )
    assert exc_info.value.exit_code != 0

    with pytest.raises(CommandExitException) as exc_info:
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
async def test_allow_takes_precedence_over_deny(async_sandbox_factory):
    """Test that allowOut takes precedence over denyOut."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic], allow_out=["1.1.1.1", "8.8.8.8"]
        )
    )

    # Test that 1.1.1.1 works (explicitly allowed)
    result1 = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result1.exit_code == 0
    assert result1.stdout.strip() == "301"

    # Test that 8.8.8.8 also works (explicitly allowed, takes precedence over deny_out)
    result2 = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
    )
    assert result2.exit_code == 0
    assert result2.stdout.strip() == "302"


@pytest.mark.skip_debug()
async def test_allow_public_traffic_false(async_sandbox_factory):
    """Test that sandbox with allow_public_traffic=False requires traffic access token."""
    async_sandbox = await async_sandbox_factory(
        secure=True, network=SandboxNetworkOpts(allow_public_traffic=False)
    )

    # Verify the sandbox was created successfully and has a traffic access token
    assert async_sandbox.traffic_access_token is not None

    # Start a simple HTTP server in the sandbox
    port = 8080
    await async_sandbox.commands.run(
        f"python3 -m http.server {port}", background=True, timeout=0
    )

    # Wait for server to start
    await asyncio.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{async_sandbox.get_host(port)}"

    async with httpx.AsyncClient() as client:
        # Test 1: Request without traffic access token should fail with 403
        response = await client.get(sandbox_url, follow_redirects=True)
        assert response.status_code == 403

        # Test 2: Request with valid traffic access token should succeed
        headers = {"e2b-traffic-access-token": async_sandbox.traffic_access_token}
        response = await wait_for_status(client, sandbox_url, 200, headers=headers)
        assert response.status_code == 200


@pytest.mark.skip_debug()
async def test_allow_public_traffic_true(async_sandbox_factory):
    """Test that sandbox with allow_public_traffic=True works without token."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(allow_public_traffic=True)
    )

    # Start a simple HTTP server in the sandbox
    port = 8080
    await async_sandbox.commands.run(
        f"python3 -m http.server {port}", background=True, timeout=0
    )

    # Wait for server to start
    await asyncio.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{async_sandbox.get_host(port)}"

    async with httpx.AsyncClient() as client:
        # Request without traffic access token should succeed (public access enabled)
        response = await wait_for_status(client, sandbox_url, 200)
        assert response.status_code == 200


@pytest.mark.skip_debug()
async def test_firewall_transform_injects_headers(async_sandbox_factory):
    """Test that a firewall rule with a transform injects headers into outbound requests."""
    injected_header = "X-E2B-Test-Token"
    injected_value = "e2b-transform-value-123"

    network: SandboxNetworkOpts = {
        "rules": {
            "httpbin.e2b.team": [
                {"transform": {"headers": {injected_header: injected_value}}},
            ],
        },
    }
    async_sandbox = await async_sandbox_factory(network=network)

    result = await async_sandbox.commands.run(
        "curl -sS --max-time 10 https://httpbin.e2b.team/headers"
    )
    assert result.exit_code == 0

    parsed = json.loads(result.stdout)
    reflected = parsed["headers"].get(injected_header)
    assert reflected == injected_value, (
        f"expected httpbin to reflect {injected_header}={injected_value}, "
        f"got headers: {parsed['headers']}"
    )


@pytest.mark.skip_debug()
async def test_update_network_applies_restrictions(async_sandbox_factory):
    """update_network can add egress restrictions to a running sandbox."""
    async_sandbox = await async_sandbox_factory()

    # Baseline: 8.8.8.8 reachable.
    before = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
    )
    assert before.exit_code == 0

    await async_sandbox.update_network({"deny_out": ["8.8.8.8"]})

    # 8.8.8.8 is now denied.
    with pytest.raises(CommandExitException) as exc_info:
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0

    # Other destinations stay reachable.
    result = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0


@pytest.mark.skip_debug()
async def test_update_network_clears_existing_rules(async_sandbox_factory):
    """update_network replaces all egress rules; omitted fields are cleared."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic],
            allow_out=["1.1.1.1"],
        )
    )

    # Baseline from create-time config: 8.8.8.8 denied.
    with pytest.raises(CommandExitException):
        await async_sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )

    # Empty update clears allow_out / deny_out entirely.
    await async_sandbox.update_network({})

    r1 = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert r1.exit_code == 0

    r2 = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
    )
    assert r2.exit_code == 0


@pytest.mark.skip_debug()
async def test_https_ports(async_sandbox_factory):
    """Test that a port listed in https_ports proxies to an HTTPS backend."""
    port = 8443
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(https_ports=[port])
    )

    # Generate a self-signed certificate inside the sandbox
    keygen = await async_sandbox.commands.run(
        "openssl req -x509 -newkey rsa:2048 "
        "-keyout /tmp/https-backend-key.pem -out /tmp/https-backend-cert.pem "
        '-days 1 -nodes -subj "/CN=localhost"'
    )
    assert keygen.exit_code == 0

    # Start an HTTPS server on the configured port
    await async_sandbox.commands.run(
        f"""python3 -c "
import http.server, ssl
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'https backend')
    def log_message(self, *a): pass
server = http.server.ThreadingHTTPServer(('0.0.0.0', {port}), H)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/tmp/https-backend-cert.pem', '/tmp/https-backend-key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
" """,
        background=True,
    )

    sandbox_url = f"https://{async_sandbox.get_host(port)}"

    async with httpx.AsyncClient() as client:
        response = await wait_for_status(client, sandbox_url, 200)
        assert response.status_code == 200
        assert response.text == "https backend"

    # The port is reported back in the sandbox info
    info = await async_sandbox.get_info()
    assert info.network is not None
    assert info.network.get("https_ports") == [port]


@pytest.mark.skip_debug()
async def test_mask_request_host(async_sandbox_factory):
    """Test that mask_request_host modifies the Host header correctly."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(mask_request_host="custom-host.example.com:${PORT}"),
        timeout=60,
    )

    import asyncio

    import httpx

    port = 8080
    output_file = "/tmp/headers.txt"

    # Start a Python HTTP server that captures request headers and writes them to a file
    await async_sandbox.commands.run(
        f"""python3 -c "
import http.server, json
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        with open('{output_file}', 'w') as f:
            for k, v in self.headers.items():
                f.write(k + ': ' + v + chr(10))
        self.send_response(200)
        self.end_headers()
    def log_message(self, *a): pass
http.server.HTTPServer(('', {port}), H).handle_request()
" """,
        background=True,
    )

    await asyncio.sleep(2)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{async_sandbox.get_host(port)}"

    # Make a request from OUTSIDE the sandbox through the proxy
    # The Host header should be modified according to mask_request_host
    async with httpx.AsyncClient() as client:
        try:
            await client.get(sandbox_url, timeout=5.0)
        except Exception:
            pass

    await asyncio.sleep(1)

    # Read the captured headers from inside the sandbox
    result = await async_sandbox.commands.run(f"cat {output_file}")

    # Verify the Host header was modified according to mask_request_host
    assert "Host:" in result.stdout
    assert "custom-host.example.com" in result.stdout
    assert str(port) in result.stdout
