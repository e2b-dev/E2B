from unittest.mock import patch

from e2b import ConnectionConfig
from e2b.cli_config import clear_cli_config_cache


def test_api_url_defaults_correctly(monkeypatch):
    monkeypatch.setenv("E2B_DOMAIN", "")

    config = ConnectionConfig()
    assert config.api_url == "https://api.e2b.app"


def test_api_url_in_args():
    config = ConnectionConfig(api_url="http://localhost:8080")
    assert config.api_url == "http://localhost:8080"


def test_api_url_in_env_var(monkeypatch):
    monkeypatch.setenv("E2B_API_URL", "http://localhost:8080")

    config = ConnectionConfig()
    assert config.api_url == "http://localhost:8080"


def test_api_url_has_correct_priority(monkeypatch):
    monkeypatch.setenv("E2B_API_URL", "http://localhost:1111")

    config = ConnectionConfig(api_url="http://localhost:8080")
    assert config.api_url == "http://localhost:8080"


class TestCliCredentials:
    def setup_method(self):
        clear_cli_config_cache()

    def teardown_method(self):
        clear_cli_config_cache()

    def test_api_key_from_cli_config_when_no_env_var(self, monkeypatch):
        monkeypatch.delenv("E2B_API_KEY", raising=False)

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig()
            assert config.api_key == "cli-api-key"

    def test_access_token_from_cli_config_when_no_env_var(self, monkeypatch):
        monkeypatch.delenv("E2B_ACCESS_TOKEN", raising=False)

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig()
            assert config.access_token == "cli-access-token"

    def test_env_var_takes_priority_over_cli_config_for_api_key(self, monkeypatch):
        monkeypatch.setenv("E2B_API_KEY", "env-api-key")

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig()
            assert config.api_key == "env-api-key"

    def test_env_var_takes_priority_over_cli_config_for_access_token(self, monkeypatch):
        monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig()
            assert config.access_token == "env-access-token"

    def test_constructor_param_takes_priority_over_env_var_and_cli_config_for_api_key(
        self, monkeypatch
    ):
        monkeypatch.setenv("E2B_API_KEY", "env-api-key")

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig(api_key="direct-api-key")
            assert config.api_key == "direct-api-key"

    def test_constructor_param_takes_priority_over_env_var_and_cli_config_for_access_token(
        self, monkeypatch
    ):
        monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value={
                "teamApiKey": "cli-api-key",
                "accessToken": "cli-access-token",
            },
        ):
            config = ConnectionConfig(access_token="direct-access-token")
            assert config.access_token == "direct-access-token"

    def test_returns_none_when_no_credentials_available(self, monkeypatch):
        monkeypatch.delenv("E2B_API_KEY", raising=False)
        monkeypatch.delenv("E2B_ACCESS_TOKEN", raising=False)

        with patch(
            "e2b.connection_config.get_cli_config",
            return_value=None,
        ):
            config = ConnectionConfig()
            assert config.api_key is None
            assert config.access_token is None
