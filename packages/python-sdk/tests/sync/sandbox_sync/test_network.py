import json
import time

import httpx

import pytest

from e2b import SandboxNetworkOpts
from e2b.sandbox.commands.command_handle import CommandExitException


def wait_for_status(
    client: httpx.Client,
    url: str,
    status_code: int,
    headers: dict[str, str] | None = None,
    timeout: float = 15,
) -> httpx.Response:
    deadline = time.monotonic() + timeout
    response: httpx.Response | None = None

    while time.monotonic() < deadline:
        response = client.get(url, headers=headers, follow_redirects=True)
        if response.status_code == status_code:
            return response
        time.sleep(1)

    assert response is not None
    return response


@pytest.mark.skip_debug()
def test_allow_specific_ip_with_deny_all(sandbox_factory):
    """Test that sandbox with denyOut all and allowOut creates a whitelist."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic], allow_out=["1.1.1.1"]
        )
    )

    # Test that allowed IP works
    result = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "301"

    # Test that other IPs are denied
    with pytest.raises(CommandExitException) as exc_info:
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
def test_deny_specific_ip(sandbox_factory):
    """Test that sandbox with denyOut denies specified IP addresses."""
    sandbox = sandbox_factory(network=SandboxNetworkOpts(deny_out=["8.8.8.8"]))

    # Test that denied IP fails
    with pytest.raises(CommandExitException) as exc_info:
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0

    # Test that other IPs work
    result = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "301"


@pytest.mark.skip_debug()
def test_deny_all_traffic(sandbox_factory):
    """Test that sandbox can deny all traffic using the all_traffic selector."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(deny_out=lambda ctx: [ctx.all_traffic]), timeout=30
    )

    # Test that all traffic is denied
    with pytest.raises(CommandExitException) as exc_info:
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://1.1.1.1"
        )
    assert exc_info.value.exit_code != 0

    with pytest.raises(CommandExitException) as exc_info:
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
def test_allow_takes_precedence_over_deny(sandbox_factory):
    """Test that allowOut takes precedence over denyOut."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic], allow_out=["1.1.1.1", "8.8.8.8"]
        )
    )

    # Test that 1.1.1.1 works (explicitly allowed)
    result1 = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result1.exit_code == 0
    assert result1.stdout.strip() == "301"

    # Test that 8.8.8.8 also works (explicitly allowed, takes precedence over deny_out)
    result2 = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
    )
    assert result2.exit_code == 0
    assert result2.stdout.strip() == "302"


@pytest.mark.skip_debug()
def test_allow_public_traffic_false(sandbox_factory):
    """Test that sandbox with allow_public_traffic=False requires traffic access token."""
    sandbox = sandbox_factory(
        secure=True, network=SandboxNetworkOpts(allow_public_traffic=False)
    )

    # Verify the sandbox was created successfully and has a traffic access token
    assert sandbox.traffic_access_token is not None

    # Start a simple HTTP server in the sandbox
    port = 8080
    sandbox.commands.run(
        f"python3 -m http.server {port}",
        background=True,
    )

    # Wait for server to start
    time.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{sandbox.get_host(port)}"

    with httpx.Client() as client:
        # Test 1: Request without traffic access token should fail with 403
        response = client.get(sandbox_url, follow_redirects=True)
        assert response.status_code == 403

        # Test 2: Request with valid traffic access token should succeed
        headers = {"e2b-traffic-access-token": sandbox.traffic_access_token}
        response = wait_for_status(client, sandbox_url, 200, headers=headers)
        assert response.status_code == 200


@pytest.mark.skip_debug()
def test_allow_public_traffic_true(sandbox_factory):
    """Test that sandbox with allow_public_traffic=True works without token."""
    sandbox = sandbox_factory(network=SandboxNetworkOpts(allow_public_traffic=True))

    # Start a simple HTTP server in the sandbox
    port = 8080
    sandbox.commands.run(
        f"python3 -m http.server {port}",
        background=True,
    )

    # Wait for server to start
    time.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{sandbox.get_host(port)}"

    with httpx.Client() as client:
        # Request without traffic access token should succeed (public access enabled)
        response = wait_for_status(client, sandbox_url, 200)
        assert response.status_code == 200


@pytest.mark.skip_debug()
def test_firewall_transform_injects_headers(sandbox_factory):
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
    sandbox = sandbox_factory(network=network)

    result = sandbox.commands.run(
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
def test_update_network_applies_restrictions(sandbox_factory):
    """update_network can add egress restrictions to a running sandbox."""
    sandbox = sandbox_factory()

    # Baseline: 8.8.8.8 reachable.
    before = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
    )
    assert before.exit_code == 0

    sandbox.update_network({"deny_out": ["8.8.8.8"]})

    # 8.8.8.8 is now denied.
    with pytest.raises(CommandExitException) as exc_info:
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )
    assert exc_info.value.exit_code != 0

    # Other destinations stay reachable.
    result = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert result.exit_code == 0


@pytest.mark.skip_debug()
def test_update_network_clears_existing_rules(sandbox_factory):
    """update_network replaces all egress rules; omitted fields are cleared."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(
            deny_out=lambda ctx: [ctx.all_traffic],
            allow_out=["1.1.1.1"],
        )
    )

    # Baseline from create-time config: 8.8.8.8 denied.
    with pytest.raises(CommandExitException):
        sandbox.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8"
        )

    # Empty update clears allow_out / deny_out entirely.
    sandbox.update_network({})

    r1 = sandbox.commands.run("curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1")
    assert r1.exit_code == 0

    r2 = sandbox.commands.run("curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8")
    assert r2.exit_code == 0


@pytest.mark.skip_debug()
def test_https_ports(sandbox_factory):
    """Test that a port listed in https_ports proxies to an HTTPS backend."""
    port = 8443
    sandbox = sandbox_factory(network=SandboxNetworkOpts(https_ports=[port]))

    # Generate a self-signed certificate inside the sandbox
    keygen = sandbox.commands.run(
        "openssl req -x509 -newkey rsa:2048 "
        "-keyout /tmp/https-backend-key.pem -out /tmp/https-backend-cert.pem "
        '-days 1 -nodes -subj "/CN=localhost"'
    )
    assert keygen.exit_code == 0

    # Start an HTTPS server on the configured port
    sandbox.commands.run(
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

    sandbox_url = f"https://{sandbox.get_host(port)}"

    with httpx.Client() as client:
        response = wait_for_status(client, sandbox_url, 200)
        assert response.status_code == 200
        assert response.text == "https backend"

    # The port is reported back in the sandbox info
    info = sandbox.get_info()
    assert info.network is not None
    assert info.network.get("https_ports") == [port]


@pytest.mark.skip_debug()
def test_mask_request_host(sandbox_factory):
    """Test that mask_request_host modifies the Host header correctly."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(mask_request_host="custom-host.example.com:${PORT}"),
        timeout=60,
    )

    import time

    import httpx

    port = 8080
    output_file = "/tmp/headers.txt"

    # Start a Python HTTP server that captures request headers and writes them to a file
    sandbox.commands.run(
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

    time.sleep(2)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{sandbox.get_host(port)}"

    # Make a request from OUTSIDE the sandbox through the proxy
    # The Host header should be modified according to mask_request_host
    with httpx.Client() as client:
        try:
            client.get(sandbox_url, timeout=5.0)
        except Exception:
            pass

    time.sleep(1)

    # Read the captured headers from inside the sandbox
    result = sandbox.commands.run(f"cat {output_file}")

    # Verify the Host header was modified according to mask_request_host
    assert "Host:" in result.stdout
    assert "custom-host.example.com" in result.stdout
    assert str(port) in result.stdout
