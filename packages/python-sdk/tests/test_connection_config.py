from e2b import ConnectionConfig


def test_api_url_defaults_correctly(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
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


def test_sandbox_url_defaults_to_stable_sandbox_host_in_production(monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DOMAIN", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig()

    assert config.get_sandbox_url("sbx-test", "e2b.app") == "https://sandbox.e2b.app"


def test_sandbox_url_keeps_per_sandbox_host_outside_production(monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig(domain="e2b.dev")

    assert (
        config.get_sandbox_url("sbx-test", "sandbox.e2b.dev")
        == "https://49983-sbx-test.sandbox.e2b.dev"
    )


def test_sandbox_url_in_args_has_priority(monkeypatch):
    monkeypatch.setenv("E2B_SANDBOX_URL", "https://sandbox.from-env")

    config = ConnectionConfig(sandbox_url="https://sandbox.custom")

    assert (
        config.get_sandbox_url("sbx-test", "e2b.app") == "https://sandbox.custom"
    )


def test_sandbox_url_in_env_var_overrides_default(monkeypatch):
    monkeypatch.setenv("E2B_SANDBOX_URL", "https://sandbox.from-env")

    config = ConnectionConfig()

    assert (
        config.get_sandbox_url("sbx-test", "e2b.app") == "https://sandbox.from-env"
    )


def test_sandbox_url_stays_localhost_in_debug_mode(monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.setenv("E2B_DEBUG", "true")

    config = ConnectionConfig()

    assert config.get_sandbox_url("sbx-test", "e2b.app") == "http://localhost:49983"
