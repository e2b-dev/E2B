import pytest

from e2b import Sandbox
from e2b.sandbox.commands.command_handle import CommandExitException


@pytest.mark.skip_debug()
def test_internet_access_enabled(template):
    """Test that sandbox with internet access enabled can reach external websites."""
    sbx = Sandbox.create(template, allow_internet_access=True)
    try:
        # Test internet connectivity by making a curl request to a reliable external site
        result = sbx.commands.run(
            "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
        )
        assert result.exit_code == 0
        assert result.stdout.strip() == "200"
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_internet_access_disabled(template):
    """Test that sandbox with internet access disabled cannot reach external websites."""
    sbx = Sandbox.create(template, allow_internet_access=False)
    try:
        # Test that internet connectivity is blocked by making a curl request
        with pytest.raises(CommandExitException) as exc_info:
            sbx.commands.run(
                "curl --connect-timeout 3 --max-time 5 -Is https://e2b.dev"
            )
            # The command should fail or timeout when internet access is disabled
        assert exc_info.value.exit_code != 0

    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_internet_access_default(template):
    """Test that sandbox with default settings (no explicit allow_internet_access) has internet access."""
    sbx = Sandbox.create(template)
    try:
        # Test internet connectivity by making a curl request to a reliable external site
        result = sbx.commands.run(
            "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
        )
        assert result.exit_code == 0
        assert result.stdout.strip() == "200"
    finally:
        sbx.kill()
