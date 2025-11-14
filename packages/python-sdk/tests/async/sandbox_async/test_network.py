import pytest

from e2b import ALL_TRAFFIC
from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
@pytest.mark.parametrize(
    "sandbox_opts",
    [{"network": {"deny_out": [ALL_TRAFFIC], "allow_out": ["1.1.1.1"]}}],
    indirect=True,
)
async def test_allow_specific_ip_with_deny_all(async_sandbox):
    """Test that sandbox with denyOut all and allowOut creates a whitelist."""
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
@pytest.mark.parametrize(
    "sandbox_opts",
    [{"network": {"deny_out": ["8.8.8.8"]}}],
    indirect=True,
)
async def test_deny_specific_ip(async_sandbox):
    """Test that sandbox with denyOut denies specified IP addresses."""
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
@pytest.mark.parametrize(
    "sandbox_opts",
    [{"network": {"deny_out": [ALL_TRAFFIC]}}],
    indirect=True,
)
async def test_deny_all_traffic(async_sandbox):
    """Test that sandbox can deny all traffic using all_traffic helper."""
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
@pytest.mark.parametrize(
    "sandbox_opts",
    [{"network": {"deny_out": [ALL_TRAFFIC], "allow_out": ["1.1.1.1", "8.8.8.8"]}}],
    indirect=True,
)
async def test_allow_takes_precedence_over_deny(async_sandbox):
    """Test that allowOut takes precedence over denyOut."""
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
