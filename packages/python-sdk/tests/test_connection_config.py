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


def test_request_timeout_defaults_to_60():
    config = ConnectionConfig()
    assert config.request_timeout == 60.0


def test_request_timeout_explicit_value():
    config = ConnectionConfig(request_timeout=30.0)
    assert config.request_timeout == 30.0


def test_request_timeout_zero_means_no_limit():
    """Passing 0 should disable the timeout (set to None)."""
    config = ConnectionConfig(request_timeout=0)
    assert config.request_timeout is None


def test_get_request_timeout_inherits_from_config():
    """get_request_timeout with no argument returns the configured default."""
    config = ConnectionConfig(request_timeout=45.0)
    assert config.get_request_timeout() == 45.0


def test_get_request_timeout_overrides_with_arg():
    """get_request_timeout with an explicit arg overrides the configured default."""
    config = ConnectionConfig(request_timeout=45.0)
    assert config.get_request_timeout(10.0) == 10.0


def test_get_request_timeout_zero_arg_means_no_limit():
    """Passing 0 to get_request_timeout disables the timeout regardless of config."""
    config = ConnectionConfig(request_timeout=45.0)
    assert config.get_request_timeout(0) is None
