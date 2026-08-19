"""The generator that projects Docker's MCP catalog onto spec/mcp-server.json,
which both SDKs derive their `McpServer` types from, is hand-written name
mangling with a few rules that are surprising enough to pin: which prefixes are
dropped, when a redundant server name is stripped from an environment variable,
and when a parameter counts as required. It lives at the repository root, where
this suite is the only test runner above it, and is loaded by path so that a
refresh can't quietly change the shape of the published types.
"""

import importlib.util
from pathlib import Path
from typing import Any

import pytest

_SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "generate-mcp-spec.py"


def _load_generator():
    spec = importlib.util.spec_from_file_location("generate_mcp_spec", _SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


generator = _load_generator()


@pytest.mark.parametrize(
    "catalog_name,expected",
    [
        ("atlan", "atlan"),
        ("airtable-mcp-server", "airtable"),
        ("aws-cdk-mcp-server", "awsCdk"),
        ("hummingbot-mcp", "hummingbot"),
        ("mcp-discord", "discord"),
        ("cyreslab-ai-shodan", "cyreslabAiShodan"),
        # Only the "mcp server" wording goes; a server that happens to end in
        # `-server` keeps it.
        ("aws-kb-retrieval-server", "awsKbRetrievalServer"),
        ("SQLite", "sqlite"),
        ("e2b", "e2b"),
    ],
)
def test_option_name(catalog_name: str, expected: str):
    assert generator.option_name(catalog_name) == expected


@pytest.mark.parametrize(
    "env,catalog_name,expected",
    [
        # The catalog repeats the server's name in the variable, so it goes.
        ("ATLAN_API_KEY", "atlan", "apiKey"),
        ("BUILDKITE_API_TOKEN", "buildkite", "apiToken"),
        ("REDIS_PWD", "redis", "pwd"),
        # Compared against the catalog name as spelled, so a hyphenated name
        # never matches the underscored variable and the prefix stays.
        ("AIRTABLE_API_KEY", "airtable-mcp-server", "airtableApiKey"),
        ("ASTRA_DB_APPLICATION_TOKEN", "astra-db", "astraDbApplicationToken"),
        ("GOOGLE_MAPS_API_KEY", "google-maps", "googleMapsApiKey"),
        # A variable naming something other than the server is kept whole.
        ("GEMINI_API_KEY", "browserbase", "geminiApiKey"),
        ("AWS_SECRET_ACCESS_KEY", "aws-kb-retrieval-server", "awsSecretAccessKey"),
    ],
)
def test_env_property(env: str, catalog_name: str, expected: str):
    assert generator.env_property(env, catalog_name) == expected


@pytest.mark.parametrize(
    "path,expected",
    [
        (["azure_dir"], "azureDir"),
        (["confluence", "api_token"], "confluenceApiToken"),
        # Keys that aren't snake_case keep their own casing.
        (["nodeenv"], "nodeenv"),
        (["SchemaPath"], "SchemaPath"),
    ],
)
def test_parameter_property(path: list[str], expected: str):
    assert generator.parameter_property(path) == expected


def test_server_schema_names_and_sorts_every_option():
    schema = generator.server_schema(
        "acme-mcp-server",
        {
            "title": "Acme",
            "description": "Does things.",
            "secrets": [{"name": "acme-mcp-server.api_key", "env": "ACME_API_KEY"}],
            "config": [
                {
                    "name": "acme-mcp-server",
                    "type": "object",
                    "properties": {
                        "base_url": {
                            "type": "string",
                            "description": "Where Acme lives.",
                        },
                        "paths": {"type": "array", "items": {"type": "string"}},
                        "retries": {"type": "integer"},
                    },
                    "required": ["base_url"],
                }
            ],
        },
    )

    assert schema["title"] == "Acme"
    assert schema["description"] == "Does things."
    assert schema["additionalProperties"] is False
    assert schema["type"] == "object"
    assert schema["x-dockerHubUrl"] == (
        "https://hub.docker.com/mcp/server/acme-mcp-server/overview"
    )
    assert list(schema["properties"]) == ["acmeApiKey", "baseUrl", "paths", "retries"]
    assert schema["properties"]["baseUrl"] == {
        "description": "Where Acme lives.",
        "type": "string",
    }
    assert schema["properties"]["paths"] == {
        "items": {"type": "string"},
        "type": "array",
    }
    assert schema["properties"]["retries"] == {"type": "integer"}


def test_declared_parameters_say_what_the_whole_server_needs():
    """Parameters that declare their `required` list replace the secrets, which
    the server then only needs for the features the caller opts into."""
    schema = generator.server_schema(
        "acme",
        {
            "secrets": [{"name": "acme.api_key", "env": "ACME_API_KEY"}],
            "config": [
                {
                    "name": "acme",
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "org": {"type": "string"},
                    },
                    "required": ["url"],
                }
            ],
        },
    )

    assert schema["required"] == ["url"]


def test_parameters_that_declare_nothing_are_all_required():
    """The reading the schema has always shipped: a parameters block that says
    nothing about what it needs is taken to need everything, alongside the
    secrets. Reading it the other way — as JSON Schema does, where an absent
    list requires nothing — would make 187 properties optional, so it is a
    deliberate policy rather than an oversight.
    """
    schema = generator.server_schema(
        "acme",
        {
            "secrets": [{"name": "acme.api_key", "env": "ACME_API_KEY"}],
            "config": [
                {
                    "name": "acme",
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "telemetry": {"type": "boolean"},
                    },
                }
            ],
        },
    )

    assert schema["required"] == ["apiKey", "telemetry", "url"]


def test_a_server_that_takes_nothing_has_no_properties():
    schema = generator.server_schema("acme", {"title": "Acme"})

    assert "properties" not in schema
    assert "required" not in schema


def test_nested_parameters_flatten_and_keep_what_they_require():
    schema = generator.server_schema(
        "atlassian",
        {
            "config": [
                {
                    "name": "atlassian",
                    "type": "object",
                    "properties": {
                        "jira": {
                            "type": "object",
                            "properties": {
                                "url": {"type": "string"},
                                "username": {"type": "string"},
                            },
                            "required": ["url"],
                        }
                    },
                }
            ],
        },
    )

    assert list(schema["properties"]) == ["jiraUrl", "jiraUsername"]
    assert schema["required"] == ["jiraUrl"]


def _entry(title: str) -> dict[str, Any]:
    return {"title": title}


def test_colliding_catalog_names_keep_the_longer_one():
    catalog = {
        "playwright": _entry("Playwright"),
        "playwright-mcp-server": _entry("ExecuteAutomation Playwright"),
        "atlan": _entry("Atlan"),
    }

    assert generator.dropped_by_collision(catalog) == {"playwright": ["playwright"]}

    spec = generator.generate(catalog)
    assert list(spec["properties"]) == ["atlan", "playwright"]
    assert spec["properties"]["playwright"]["title"] == "ExecuteAutomation Playwright"


def test_the_spec_is_a_closed_object_of_sorted_servers():
    spec = generator.generate({"zulip": _entry("Zulip"), "atlan": _entry("Atlan")})

    assert spec["additionalProperties"] is False
    assert spec["type"] == "object"
    assert list(spec["properties"]) == ["atlan", "zulip"]
