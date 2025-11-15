import pytest

from e2b import ALL_TRAFFIC, SandboxNetworkOpts
from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
async def test_allow_specific_ip_with_deny_all(async_sandbox_factory):
    """Test that sandbox with denyOut all and allowOut creates a whitelist."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(deny_out=[ALL_TRAFFIC], allow_out=["1.1.1.1"])
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
    """Test that sandbox can deny all traffic using all_traffic helper."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(deny_out=[ALL_TRAFFIC]), timeout=30
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
            deny_out=[ALL_TRAFFIC], allow_out=["1.1.1.1", "8.8.8.8"]
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

    import asyncio

    import httpx

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
        response = await client.get(sandbox_url, headers=headers, follow_redirects=True)
        assert response.status_code == 200


@pytest.mark.skip_debug()
async def test_allow_public_traffic_true(async_sandbox_factory):
    """Test that sandbox with allow_public_traffic=True works without token."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(allow_public_traffic=True)
    )

    import asyncio

    import httpx

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
        response = await client.get(sandbox_url, follow_redirects=True)
        assert response.status_code == 200


@pytest.mark.skip_debug()
async def test_mask_request_host(async_sandbox_factory):
    """Test that mask_request_host modifies the Host header correctly."""
    async_sandbox = await async_sandbox_factory(
        network=SandboxNetworkOpts(mask_request_host="custom-host.example.com:${PORT}"),
        timeout=60,
    )

    import asyncio

    import httpx

    # Install netcat for testing
    await async_sandbox.commands.run("apt-get update", user="root")
    await async_sandbox.commands.run(
        "apt-get install -y netcat-traditional", user="root"
    )

    port = 8080
    output_file = "/tmp/nc_output.txt"

    # Start netcat listener in background to capture request headers
    await async_sandbox.commands.run(
        f"nc -l -p {port} > {output_file}",
        background=True,
        timeout=0,
        user="root",
    )

    # Wait for netcat to start
    await asyncio.sleep(3)

    # Get the public URL for the sandbox
    sandbox_url = f"https://{async_sandbox.get_host(port)}"

    # Make a request from OUTSIDE the sandbox through the proxy
    # The Host header should be modified according to mask_request_host
    async with httpx.AsyncClient() as client:
        try:
            await client.get(sandbox_url, timeout=5.0)
        except Exception:
            # Request may fail since netcat doesn't respond properly, but headers are captured
            pass

    # Read the captured output from inside the sandbox
    result = await async_sandbox.commands.run(f"cat {output_file}", user="root")

    # Verify the Host header was modified according to mask_request_host
    assert "Host:" in result.stdout
    assert "custom-host.example.com" in result.stdout
    assert str(port) in result.stdout
