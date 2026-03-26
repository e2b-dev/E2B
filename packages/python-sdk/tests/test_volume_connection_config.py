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
