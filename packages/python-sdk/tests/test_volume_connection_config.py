from e2b.volume.connection_config import VolumeConnectionConfig


def test_volume_api_url_defaults_correctly(monkeypatch):
    monkeypatch.delenv("E2B_VOLUME_API_URL", raising=False)
    monkeypatch.delenv("E2B_DOMAIN", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = VolumeConnectionConfig()
    assert config.api_url == "https://api.e2b.app"


def test_volume_api_url_in_args():
    config = VolumeConnectionConfig(api_url="http://localhost:8080")
    assert config.api_url == "http://localhost:8080"


def test_volume_api_url_in_env_var(monkeypatch):
    monkeypatch.setenv("E2B_VOLUME_API_URL", "http://localhost:8080")

    config = VolumeConnectionConfig()
    assert config.api_url == "http://localhost:8080"


def test_volume_api_url_has_correct_priority(monkeypatch):
    monkeypatch.setenv("E2B_VOLUME_API_URL", "http://localhost:1111")

    config = VolumeConnectionConfig(api_url="http://localhost:8080")
    assert config.api_url == "http://localhost:8080"


def test_volume_api_url_debug_mode(monkeypatch):
    monkeypatch.delenv("E2B_VOLUME_API_URL", raising=False)
    monkeypatch.setenv("E2B_DEBUG", "true")

    config = VolumeConnectionConfig()
    assert config.api_url == "http://localhost:8080"


def test_volume_api_url_custom_domain(monkeypatch):
    monkeypatch.delenv("E2B_VOLUME_API_URL", raising=False)
    monkeypatch.setenv("E2B_DOMAIN", "custom.com")

    config = VolumeConnectionConfig()
    assert config.api_url == "https://api.custom.com"


def test_volume_api_url_custom_domain_in_args():
    config = VolumeConnectionConfig(domain="custom.com")
    assert config.api_url == "https://api.custom.com"


def test_volume_token_does_not_fall_back_to_access_token_env(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    config = VolumeConnectionConfig()
    assert config.token is None
    assert config.access_token is None


def test_volume_token_in_args(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    config = VolumeConnectionConfig(token="vol-token")
    assert config.token == "vol-token"
    assert config.access_token == "vol-token"


def test_volume_config_does_not_mutate_caller_headers():
    headers = {"X-Custom": "value"}

    config = VolumeConnectionConfig(headers=headers)

    assert headers == {"X-Custom": "value"}
    assert config.headers["X-Custom"] == "value"
    assert "User-Agent" in config.headers


def test_volume_request_timeout_defaults_to_60_seconds():
    config = VolumeConnectionConfig()
    assert config.request_timeout == 60.0


def test_volume_request_timeout_in_args():
    config = VolumeConnectionConfig(request_timeout=10.0)
    assert config.request_timeout == 10.0


def test_volume_request_timeout_zero_disables_timeout():
    config = VolumeConnectionConfig(request_timeout=0)
    assert config.request_timeout is None
