import pytest

from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
async def test_internet_access_enabled(async_sandbox_factory):
    """Test that sandbox with internet access enabled can reach external websites."""
    sbx = await async_sandbox_factory(allow_internet_access=True)

    # Test internet connectivity by making a curl request to a reliable external site
    result = await sbx.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "200"


@pytest.mark.skip_debug()
async def test_internet_access_disabled(async_sandbox_factory):
    """Test that sandbox with internet access disabled cannot reach external websites."""
    sbx = await async_sandbox_factory(allow_internet_access=False)

    # Test that internet connectivity is blocked by making a curl request
    with pytest.raises(CommandExitException) as exc_info:
        await sbx.commands.run(
            "curl --connect-timeout 3 --max-time 5 -Is https://e2b.dev"
        )
        # The command should fail or timeout when internet access is disabled
    assert exc_info.value.exit_code != 0


@pytest.mark.skip_debug()
async def test_internet_access_default(async_sandbox):
    """Test that sandbox with default settings (no explicit allow_internet_access) has internet access."""
    # Test internet connectivity by making a curl request to a reliable external site

    result = await async_sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
    )
    assert result.exit_code == 0
    assert result.stdout.strip() == "200"
