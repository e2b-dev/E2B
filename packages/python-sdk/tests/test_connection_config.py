from e2b import ConnectionConfig


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


def test_api_key_prefix_defaults_to_e2b(monkeypatch):
    monkeypatch.delenv("E2B_API_KEY_PREFIX", raising=False)

    config = ConnectionConfig()
    assert config.api_key_prefix == "e2b_"


def test_api_key_prefix_from_env_var(monkeypatch):
    monkeypatch.setenv("E2B_API_KEY_PREFIX", "myorg_")

    config = ConnectionConfig()
    assert config.api_key_prefix == "myorg_"


def test_api_key_prefix_arg_has_priority_over_env_var(monkeypatch):
    monkeypatch.setenv("E2B_API_KEY_PREFIX", "fromenv_")

    config = ConnectionConfig(api_key_prefix="fromargs_")
    assert config.api_key_prefix == "fromargs_"
