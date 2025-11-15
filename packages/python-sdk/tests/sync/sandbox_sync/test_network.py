import pytest

from e2b import ALL_TRAFFIC, SandboxNetworkOpts
from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
def test_allow_specific_ip_with_deny_all(sandbox_factory):
    """Test that sandbox with denyOut all and allowOut creates a whitelist."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(deny_out=[ALL_TRAFFIC], allow_out=["1.1.1.1"])
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
    """Test that sandbox can deny all traffic using all_traffic helper."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(deny_out=[ALL_TRAFFIC]), timeout=30
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
            deny_out=[ALL_TRAFFIC], allow_out=["1.1.1.1", "8.8.8.8"]
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

    import time

    import httpx

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
        response = client.get(sandbox_url, headers=headers, follow_redirects=True)
        assert response.status_code == 200


@pytest.mark.skip_debug()
def test_allow_public_traffic_true(sandbox_factory):
    """Test that sandbox with allow_public_traffic=True works without token."""
    sandbox = sandbox_factory(network=SandboxNetworkOpts(allow_public_traffic=True))

    import time

    import httpx

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
        response = client.get(sandbox_url, follow_redirects=True)
        assert response.status_code == 200


@pytest.mark.skip_debug()
def test_mask_request_host(sandbox_factory):
    """Test that mask_request_host modifies the Host header correctly."""
    sandbox = sandbox_factory(
        network=SandboxNetworkOpts(mask_request_host="custom-host.example.com:${PORT}"),
        timeout=60,
    )

    import time

    import httpx

    # Install netcat for testing
    sandbox.commands.run("apt-get update", user="root")
    sandbox.commands.run("apt-get install -y netcat-traditional", user="root")

    port = 8080
    output_file = "/tmp/nc_output.txt"

    # Start netcat listener in background to capture request headers
    sandbox.commands.run(
        f"nc -l -p {port} > {output_file}",
        background=True,
        user="root",
    )

    # Wait for netcat to start
    time.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{sandbox.get_host(port)}"

    # Make a request from OUTSIDE the sandbox through the proxy
    # The Host header should be modified according to mask_request_host
    with httpx.Client() as client:
        try:
            client.get(sandbox_url, timeout=5.0)
        except Exception:
            # Request may fail since netcat doesn't respond properly, but headers are captured
            pass

    # Read the captured output from inside the sandbox
    result = sandbox.commands.run(f"cat {output_file}", user="root")

    # Verify the Host header was modified according to mask_request_host
    assert "Host:" in result.stdout
    assert "custom-host.example.com" in result.stdout
    assert str(port) in result.stdout
