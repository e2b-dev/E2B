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
    sandbox = sandbox_factory(network=SandboxNetworkOpts(deny_out=[ALL_TRAFFIC]))

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
