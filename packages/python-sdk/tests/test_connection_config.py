from e2b import ConnectionConfig


def test_api_url_defaults_correctly(monkeypatch):
    monkeypatch.setenv("E2B_DOMAIN", "")
    monkeypatch.delenv("E2B_API_URL", raising=False)

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


def test_validate_api_key_defaults_to_true(monkeypatch):
    monkeypatch.delenv("E2B_VALIDATE_API_KEY", raising=False)

    config = ConnectionConfig()
    assert config.validate_api_key is True


def test_validate_api_key_disabled_via_env_var(monkeypatch):
    monkeypatch.setenv("E2B_VALIDATE_API_KEY", "false")

    config = ConnectionConfig()
    assert config.validate_api_key is False


def test_validate_api_key_arg_has_priority_over_env_var(monkeypatch):
    monkeypatch.setenv("E2B_VALIDATE_API_KEY", "true")

    config = ConnectionConfig(validate_api_key=False)
    assert config.validate_api_key is False


def test_sandbox_url_uses_stable_host_for_supported_domain():
    config = ConnectionConfig(domain="e2b.app")

    assert config.get_sandbox_url("sandbox-id", "e2b.app") == "https://sandbox.e2b.app"


def test_sandbox_url_uses_stable_host_for_supported_non_prod_domain():
    config = ConnectionConfig(domain="e2b.dev")

    assert config.get_sandbox_url("sandbox-id", "e2b.dev") == "https://sandbox.e2b.dev"


def test_sandbox_url_uses_explicit_url_first():
    config = ConnectionConfig(sandbox_url="https://sandbox.example.com")

    assert (
        config.get_sandbox_url("sandbox-id", "e2b.app") == "https://sandbox.example.com"
    )


def test_sandbox_url_falls_back_to_per_sandbox_host_for_custom_domain():
    config = ConnectionConfig(domain="custom.example")

    assert (
        config.get_sandbox_url("sandbox-id", "custom.example")
        == "https://49983-sandbox-id.custom.example"
    )


def test_sandbox_url_falls_back_to_per_sandbox_host_for_unsupported_subdomain():
    config = ConnectionConfig(domain="e2b.dev")

    assert (
        config.get_sandbox_url("sandbox-id", "sandbox.e2b.dev")
        == "https://49983-sandbox-id.sandbox.e2b.dev"
    )


def test_sandbox_url_debug_uses_localhost():
    config = ConnectionConfig(debug=True)

    assert config.get_sandbox_url("sandbox-id", "e2b.app") == "http://localhost:49983"


def test_get_host_keeps_per_sandbox_host_for_supported_domain():
    config = ConnectionConfig(domain="e2b.app")

    assert config.get_host("sandbox-id", "e2b.app", 8888) == "8888-sandbox-id.e2b.app"


def test_sandbox_direct_url_keeps_per_sandbox_host_for_supported_domain():
    config = ConnectionConfig(domain="e2b.app")

    assert (
        config.get_sandbox_direct_url("sandbox-id", "e2b.app")
        == "https://49983-sandbox-id.e2b.app"
    )


def test_sandbox_direct_url_uses_explicit_url_first():
    config = ConnectionConfig(sandbox_url="https://sandbox.example.com")

    assert (
        config.get_sandbox_direct_url("sandbox-id", "e2b.app")
        == "https://sandbox.example.com"
    )


def test_debug_false_overrides_env_var(monkeypatch):
    monkeypatch.setenv("E2B_DEBUG", "true")

    config = ConnectionConfig(debug=False)
    assert config.debug is False


def test_debug_defaults_to_env_var(monkeypatch):
    monkeypatch.setenv("E2B_DEBUG", "true")

    config = ConnectionConfig()
    assert config.debug is True


def test_integration_option_is_appended_to_user_agent():
    config = ConnectionConfig(integration="testing/version")

    assert config.headers["User-Agent"].startswith("e2b-python-sdk/")
    assert config.headers["User-Agent"].endswith(" testing/version")


def test_integration_option_survives_api_param_rebuilds():
    config = ConnectionConfig(integration="testing/version")
    rebuilt_config = ConnectionConfig(**config.get_api_params())

    assert rebuilt_config.headers["User-Agent"].endswith(" testing/version")
    assert rebuilt_config.get_api_params(api_headers={"X-Test": "1"})["headers"][
        "User-Agent"
    ].endswith(" testing/version")


def test_request_timeout_zero_means_no_timeout():
    config = ConnectionConfig(request_timeout=0)
    assert config.request_timeout is None
    assert config.get_request_timeout() is None
    # A per-call value of 0 also disables the timeout.
    assert config.get_request_timeout(0) is None


def test_get_api_params_includes_sandbox_url():
    config = ConnectionConfig(sandbox_url="https://sandbox.example.com")

    params = config.get_api_params()
    assert params["sandbox_url"] == "https://sandbox.example.com"

    # Per-call override takes priority.
    overridden = config.get_api_params(sandbox_url="https://sandbox.override.com")
    assert overridden["sandbox_url"] == "https://sandbox.override.com"
