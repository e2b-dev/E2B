import json

import pytest

from e2b.cli_config import (
    get_cli_config,
    get_cli_config_path,
    clear_cli_config_cache,
    CLIConfig,
)


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear CLI config cache before and after each test."""
    clear_cli_config_cache()
    yield
    clear_cli_config_cache()


@pytest.fixture
def cli_config_path():
    """Get the CLI config path."""
    return get_cli_config_path()


@pytest.fixture
def backup_restore_config(cli_config_path):
    """Backup and restore the CLI config file."""
    original_content = None
    existed = cli_config_path.exists()

    if existed:
        original_content = cli_config_path.read_text()

    yield

    if existed and original_content is not None:
        cli_config_path.parent.mkdir(parents=True, exist_ok=True)
        cli_config_path.write_text(original_content)
    elif not existed and cli_config_path.exists():
        cli_config_path.unlink()


class TestGetCliConfig:
    def test_returns_none_when_config_file_does_not_exist(
        self, cli_config_path, backup_restore_config
    ):
        if cli_config_path.exists():
            cli_config_path.unlink()
        clear_cli_config_cache()

        config = get_cli_config()
        assert config is None

    def test_returns_parsed_config_when_file_exists(
        self, cli_config_path, backup_restore_config
    ):
        mock_config: CLIConfig = {
            "email": "test@example.com",
            "accessToken": "test-access-token",
            "teamName": "test-team",
            "teamId": "team-123",
            "teamApiKey": "test-api-key",
        }

        cli_config_path.parent.mkdir(parents=True, exist_ok=True)
        cli_config_path.write_text(json.dumps(mock_config))
        clear_cli_config_cache()

        config = get_cli_config()
        assert config == mock_config

    def test_returns_none_when_config_file_contains_invalid_json(
        self, cli_config_path, backup_restore_config
    ):
        cli_config_path.parent.mkdir(parents=True, exist_ok=True)
        cli_config_path.write_text("invalid json")
        clear_cli_config_cache()

        config = get_cli_config()
        assert config is None

    def test_caches_config_after_first_read(
        self, cli_config_path, backup_restore_config
    ):
        mock_config: CLIConfig = {
            "teamApiKey": "cached-api-key",
        }

        cli_config_path.parent.mkdir(parents=True, exist_ok=True)
        cli_config_path.write_text(json.dumps(mock_config))
        clear_cli_config_cache()

        config1 = get_cli_config()

        cli_config_path.write_text(json.dumps({"teamApiKey": "different-key"}))

        config2 = get_cli_config()

        assert config1 == mock_config
        assert config2 == mock_config

    def test_clear_cli_config_cache_allows_re_reading_config(
        self, cli_config_path, backup_restore_config
    ):
        mock_config1: CLIConfig = {"teamApiKey": "key1"}
        mock_config2: CLIConfig = {"teamApiKey": "key2"}

        cli_config_path.parent.mkdir(parents=True, exist_ok=True)
        cli_config_path.write_text(json.dumps(mock_config1))
        clear_cli_config_cache()

        config1 = get_cli_config()
        assert config1 == mock_config1

        cli_config_path.write_text(json.dumps(mock_config2))
        clear_cli_config_cache()

        config2 = get_cli_config()
        assert config2 == mock_config2
