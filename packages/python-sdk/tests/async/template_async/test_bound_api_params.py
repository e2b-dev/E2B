from unittest.mock import AsyncMock

import pytest

import e2b.template_async.main as template_async_main
from e2b import AsyncTemplate, Template, TemplateTagInfo
from e2b.connection_config import ApiParams
from e2b.template.types import BuildInfo

BOUND_API_KEY = "e2b_" + "1" * 40
BOUND_DOMAIN = "bound.example.com"
PER_CALL_DOMAIN = "per-call.example.com"


class BoundAsyncTemplate(AsyncTemplate):
    """Stands in for the per-client ``client.Template`` — same statics, bound config."""

    _bound_api_params: ApiParams = {
        "api_key": BOUND_API_KEY,
        "domain": BOUND_DOMAIN,
    }


@pytest.fixture
def configs(monkeypatch):
    """Capture the connection config each terminal operation resolves."""
    captured = []

    def fake_get_api_client(config, *args, **kwargs):
        captured.append(config)
        return None

    monkeypatch.delenv("E2B_API_URL", raising=False)
    monkeypatch.setattr(template_async_main, "get_api_client", fake_get_api_client)
    monkeypatch.setattr(
        template_async_main, "check_alias_exists", AsyncMock(return_value=True)
    )
    monkeypatch.setattr(
        template_async_main, "get_template_tags", AsyncMock(return_value=[])
    )
    monkeypatch.setattr(
        template_async_main,
        "assign_tags",
        AsyncMock(
            return_value=TemplateTagInfo(build_id="build-id", tags=["production"])
        ),
    )
    monkeypatch.setattr(
        template_async_main, "remove_tags", AsyncMock(return_value=None)
    )

    return captured


@pytest.mark.asyncio
async def test_top_level_template_uses_per_call_params(configs, test_api_key):
    await AsyncTemplate.exists(
        "my-template", api_key=test_api_key, domain=PER_CALL_DOMAIN
    )
    await AsyncTemplate.get_tags(
        "my-template", api_key=test_api_key, domain=PER_CALL_DOMAIN
    )
    await AsyncTemplate.assign_tags(
        "my-template:v1.0",
        "production",
        api_key=test_api_key,
        domain=PER_CALL_DOMAIN,
    )
    await AsyncTemplate.remove_tags(
        "my-template", "production", api_key=test_api_key, domain=PER_CALL_DOMAIN
    )

    assert len(configs) == 4
    for config in configs:
        assert config.api_key == test_api_key
        assert config.domain == PER_CALL_DOMAIN


@pytest.mark.asyncio
async def test_top_level_template_falls_back_to_env(configs, monkeypatch, test_api_key):
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    monkeypatch.setenv("E2B_DOMAIN", "env.example.com")

    await AsyncTemplate.exists("my-template")

    assert configs[0].api_key == test_api_key
    assert configs[0].domain == "env.example.com"


@pytest.mark.asyncio
async def test_bound_params_are_defaults(configs):
    await BoundAsyncTemplate.exists("my-template")
    await BoundAsyncTemplate.alias_exists("my-template")
    await BoundAsyncTemplate.get_tags("my-template")
    await BoundAsyncTemplate.assign_tags("my-template:v1.0", "production")
    await BoundAsyncTemplate.remove_tags("my-template", "production")

    assert len(configs) == 5
    for config in configs:
        assert config.api_key == BOUND_API_KEY
        assert config.domain == BOUND_DOMAIN


@pytest.mark.asyncio
async def test_per_call_params_override_bound_params(configs, test_api_key):
    await BoundAsyncTemplate.exists(
        "my-template", api_key=test_api_key, domain=PER_CALL_DOMAIN
    )

    assert configs[0].api_key == test_api_key
    assert configs[0].domain == PER_CALL_DOMAIN


@pytest.mark.asyncio
async def test_none_per_call_params_keep_bound_params(configs):
    await BoundAsyncTemplate.exists("my-template", api_key=None, domain=None)

    assert configs[0].api_key == BOUND_API_KEY
    assert configs[0].domain == BOUND_DOMAIN


@pytest.mark.asyncio
async def test_build_resolves_build_impl_and_config_off_cls(configs, monkeypatch):
    build_info = BuildInfo(
        template_id="template-id",
        build_id="build-id",
        alias="my-template",
        name="my-template",
        tags=[],
    )
    mock_build = AsyncMock(return_value=build_info)
    monkeypatch.setattr(BoundAsyncTemplate, "_build", staticmethod(mock_build))

    assert (
        await BoundAsyncTemplate.build_in_background(
            Template().from_base_image(), "my-template"
        )
        is build_info
    )

    mock_build.assert_awaited_once()
    assert configs[0].api_key == BOUND_API_KEY
    assert configs[0].domain == BOUND_DOMAIN
