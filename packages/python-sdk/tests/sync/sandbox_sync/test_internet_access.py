import pytest

from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
def test_internet_access_enabled(sandbox_factory):
    """Test that sandbox with internet access enabled can reach external websites."""
    sbx = sandbox_factory(allow_internet_access=True)

    # Test internet connectivity by making a curl request to a reliable external site
    result = sbx.commands.run("curl -s -o /dev/null -w '%{http_code}' https://e2b.dev")
    assert result.exit_code == 0
    assert result.stdout.strip() == "200"


@pytest.mark.skip_debug()
def test_internet_access_disabled(sandbox_factory):
    """Test that sandbox with internet access disabled cannot reach external websites."""
    sbx = sandbox_factory(allow_internet_access=False)

    # Test that internet connectivity is blocked by making a curl request
    with pytest.raises(CommandExitException) as exc_info:
        sbx.commands.run("curl --connect-timeout 3 --max-time 5 -Is https://e2b.dev")
        # The command should fail or timeout when internet access is disabled
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
def test_internet_access_default(sandbox):
    """Test that sandbox with default settings (no explicit allow_internet_access) has internet access."""

    # Test internet connectivity by making a curl request to a reliable external site
    result = sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "200"
