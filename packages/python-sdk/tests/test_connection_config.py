import pytest

from e2b import ConnectionConfig
from e2b.connection_config import DEFAULT_RETRIES
from e2b.exceptions import InvalidArgumentException


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


def test_project_and_region_default_to_unset(monkeypatch):
    monkeypatch.delenv("E2B_PROJECT_ID", raising=False)
    monkeypatch.delenv("E2B_REGION", raising=False)

    config = ConnectionConfig(domain="e2b.app")
    assert config.project_id is None
    assert config.region is None
    assert config.resolved_domain == "e2b.app"


def test_project_and_region_in_args_scope_api_url(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig(
        domain="e2b.app", project_id="prj-123", region="us-east-1"
    )

    assert config.domain == "e2b.app"
    assert config.resolved_domain == "prj-123.prj.us-east-1.e2b.app"
    assert config.api_url == "https://api.prj-123.prj.us-east-1.e2b.app"


def test_project_and_region_in_env_vars_scope_api_url(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)
    monkeypatch.setenv("E2B_DOMAIN", "e2b.dev")
    monkeypatch.setenv("E2B_PROJECT_ID", "prj-env")
    monkeypatch.setenv("E2B_REGION", "eu-west-1")

    config = ConnectionConfig()

    assert config.project_id == "prj-env"
    assert config.region == "eu-west-1"
    assert config.api_url == "https://api.prj-env.prj.eu-west-1.e2b.dev"


def test_project_and_region_in_args_have_priority_over_env_vars(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.setenv("E2B_PROJECT_ID", "prj-env")
    monkeypatch.setenv("E2B_REGION", "eu-west-1")

    config = ConnectionConfig(
        domain="e2b.app", project_id="prj-arg", region="us-east-1"
    )

    assert config.resolved_domain == "prj-arg.prj.us-east-1.e2b.app"


def test_empty_project_and_region_env_vars_mean_unset(monkeypatch):
    monkeypatch.setenv("E2B_PROJECT_ID", "")
    monkeypatch.setenv("E2B_REGION", "")

    config = ConnectionConfig(domain="e2b.app")
    assert config.project_id is None
    assert config.region is None
    assert config.resolved_domain == "e2b.app"


def test_project_without_region_leaves_domain_unscoped(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)
    monkeypatch.delenv("E2B_REGION", raising=False)

    config = ConnectionConfig(domain="e2b.app", project_id="prj-123")

    assert config.project_id == "prj-123"
    assert config.resolved_domain == "e2b.app"
    assert config.api_url == "https://api.e2b.app"


def test_explicit_api_url_wins_over_project_and_region():
    config = ConnectionConfig(
        api_url="http://localhost:8080", project_id="prj-123", region="us-east-1"
    )

    assert config.api_url == "http://localhost:8080"


def test_project_and_region_survive_api_param_rebuilds(monkeypatch):
    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig(
        domain="e2b.app", project_id="prj-123", region="us-east-1"
    )
    rebuilt = ConnectionConfig(**config.get_api_params())

    assert rebuilt.project_id == "prj-123"
    assert rebuilt.region == "us-east-1"
    assert rebuilt.api_url == "https://api.prj-123.prj.us-east-1.e2b.app"

    # Per-call override takes priority.
    overridden = config.get_api_params(project_id="prj-other", region="eu-west-1")
    assert overridden["project_id"] == "prj-other"
    assert overridden["region"] == "eu-west-1"


def test_sandbox_host_falls_back_to_project_endpoint_without_sandbox_domain(
    monkeypatch,
):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig(
        domain="e2b.app", project_id="prj-123", region="us-east-1"
    )

    assert (
        config.get_sandbox_url("sbx-test", "")
        == "https://49983-sbx-test.prj-123.prj.us-east-1.e2b.app"
    )


def test_sandbox_domain_from_api_wins_over_project_endpoint(monkeypatch):
    monkeypatch.delenv("E2B_SANDBOX_URL", raising=False)
    monkeypatch.delenv("E2B_DEBUG", raising=False)

    config = ConnectionConfig(
        domain="e2b.app", project_id="prj-123", region="us-east-1"
    )

    assert config.get_sandbox_url("sbx-test", "e2b.app") == "https://sandbox.e2b.app"


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


def test_set_integration_appends_to_user_agent():
    ConnectionConfig.set_integration("testing/version")
    try:
        config = ConnectionConfig()

        assert config.headers["User-Agent"].startswith("e2b-python-sdk/")
        assert "testing/version" in config.headers["User-Agent"].split()
    finally:
        ConnectionConfig.set_integration(None)

    config = ConnectionConfig()
    assert "testing" not in config.headers["User-Agent"]


def test_user_agent_includes_configured_traffic_source(monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci")

    config = ConnectionConfig()

    assert config.headers["User-Agent"].endswith(" source/ci")


def test_user_agent_ignores_unsafe_traffic_source(monkeypatch):
    monkeypatch.setenv("E2B_USER_AGENT_SOURCE", "ci bad\nheader")

    config = ConnectionConfig()

    assert "source/" not in config.headers["User-Agent"]


def test_custom_user_agent_is_preserved_without_integration():
    config = ConnectionConfig(api_headers={"User-Agent": "custom/1.0"})

    assert config.headers["User-Agent"] == "custom/1.0"


def test_custom_user_agent_wins_over_integration(monkeypatch):
    monkeypatch.setattr(ConnectionConfig, "_integration", "testing/version")

    config = ConnectionConfig(api_headers={"User-Agent": "custom/1.0"})

    assert config.headers["User-Agent"] == "custom/1.0"


def test_integration_survives_api_param_rebuilds(monkeypatch):
    monkeypatch.setattr(ConnectionConfig, "_integration", "testing/version")

    config = ConnectionConfig()
    rebuilt_config = ConnectionConfig(**config.get_api_params())

    assert "testing/version" in rebuilt_config.headers["User-Agent"].split()
    rebuilt_user_agent = rebuilt_config.get_api_params(api_headers={"X-Test": "1"})[
        "headers"
    ]["User-Agent"]
    assert "testing/version" in rebuilt_user_agent.split()


def test_cleared_integration_does_not_leak_into_api_param_rebuilds():
    ConnectionConfig.set_integration("testing/version")
    try:
        config = ConnectionConfig()
    finally:
        ConnectionConfig.set_integration(None)

    params = config.get_api_params()
    assert not params["headers"]["User-Agent"].endswith(" testing/version")

    rebuilt_config = ConnectionConfig(**params)
    assert not rebuilt_config.headers["User-Agent"].endswith(" testing/version")


def test_custom_user_agent_survives_api_param_rebuilds(monkeypatch):
    monkeypatch.setattr(ConnectionConfig, "_integration", "testing/version")

    config = ConnectionConfig(api_headers={"User-Agent": "custom/1.0"})
    rebuilt_config = ConnectionConfig(**config.get_api_params())

    assert rebuilt_config.headers["User-Agent"] == "custom/1.0"

    monkeypatch.setattr(ConnectionConfig, "_integration", None)

    config = ConnectionConfig(api_headers={"User-Agent": "custom/1.0"})
    rebuilt_config = ConnectionConfig(**config.get_api_params())
    assert rebuilt_config.headers["User-Agent"] == "custom/1.0"


def test_per_call_user_agent_override_wins_in_api_params(monkeypatch):
    monkeypatch.setattr(ConnectionConfig, "_integration", "testing/version")

    config = ConnectionConfig()
    params = config.get_api_params(api_headers={"User-Agent": "custom/1.0"})
    assert params["headers"]["User-Agent"] == "custom/1.0"


def test_per_call_api_headers_user_agent_wins_over_headers():
    config = ConnectionConfig()
    params = config.get_api_params(
        headers={"User-Agent": "from-headers/1.0"},
        api_headers={"User-Agent": "from-api-headers/1.0"},
    )
    assert params["headers"]["User-Agent"] == "from-api-headers/1.0"


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


def test_retries_default_to_three_and_propagate():
    config = ConnectionConfig(retries=5)

    assert ConnectionConfig().retries == DEFAULT_RETRIES
    assert config.retries == 5
    assert config.get_api_params()["retries"] == 5
    assert config.get_api_params(retries=0)["retries"] == 0


@pytest.mark.parametrize("retries", [-1, 1.5, True])
def test_retries_reject_invalid_values(retries):
    with pytest.raises(InvalidArgumentException):
        ConnectionConfig(retries=retries)
