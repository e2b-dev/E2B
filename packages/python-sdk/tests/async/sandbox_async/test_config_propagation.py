from e2b.connection_config import ConnectionConfig


def make_config() -> ConnectionConfig:
    return ConnectionConfig(
        api_key="base-api-key",
        domain="base.e2b.dev",
        request_timeout=11,
        headers={"X-Test": "base"},
    )


def test_get_api_params_returns_base_config_without_overrides():
    config = make_config()
    result = config.get_api_params()

    assert result["api_key"] == "base-api-key"
    assert result["domain"] == "base.e2b.dev"
    assert result["request_timeout"] == 11
    assert result["headers"]["X-Test"] == "base"


def test_get_api_params_applies_overrides():
    config = make_config()
    result = config.get_api_params(
        domain="override.e2b.dev",
        request_timeout=20,
        headers={"X-Extra": "1"},
    )

    assert result["api_key"] == "base-api-key"
    assert result["domain"] == "override.e2b.dev"
    assert result["request_timeout"] == 20
    assert result["headers"]["X-Test"] == "base"
    assert result["headers"]["X-Extra"] == "1"
