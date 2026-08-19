from e2b import (
    E2B,
    AsyncSandbox,
    AsyncTemplate,
    AsyncVolume,
    Sandbox,
    Secret,
    Template,
    Volume,
)


def test_client_exposes_bound_subclasses():
    client = E2B(api_key="client-key", domain="client.example")

    assert issubclass(client.Sandbox, Sandbox)
    assert issubclass(client.AsyncSandbox, AsyncSandbox)
    assert issubclass(client.Volume, Volume)
    assert issubclass(client.AsyncVolume, AsyncVolume)
    assert issubclass(client.Template, Template)
    assert issubclass(client.AsyncTemplate, AsyncTemplate)
    assert client.Secret is Secret


def test_client_defaults_are_merged_below_per_call_opts():
    client = E2B(api_key="client-key", domain="client.example")

    merged = client.Sandbox._with_api_defaults({})
    assert merged == {"api_key": "client-key", "domain": "client.example"}

    overridden = client.Sandbox._with_api_defaults({"api_key": "call-key"})
    assert overridden["api_key"] == "call-key"
    assert overridden["domain"] == "client.example"


def test_clients_are_independent():
    client_a = E2B(api_key="key-a")
    client_b = E2B(api_key="key-b", api_url="https://api.b.example")

    assert client_a.Sandbox._with_api_defaults({}) == {"api_key": "key-a"}
    assert client_b.Sandbox._with_api_defaults({}) == {
        "api_key": "key-b",
        "api_url": "https://api.b.example",
    }


def test_top_level_classes_have_no_defaults():
    E2B(api_key="client-key")

    assert Sandbox._with_api_defaults({}) == {}
    assert AsyncSandbox._with_api_defaults({}) == {}
    assert Volume._with_api_defaults({}) == {}
    assert AsyncVolume._with_api_defaults({}) == {}
    assert Template._with_api_defaults({}) == {}
    assert AsyncTemplate._with_api_defaults({}) == {}


def test_all_resources_share_client_defaults():
    client = E2B(api_key="client-key")

    for resource in (
        client.Sandbox,
        client.AsyncSandbox,
        client.Volume,
        client.AsyncVolume,
        client.Template,
        client.AsyncTemplate,
    ):
        assert resource._with_api_defaults({})["api_key"] == "client-key"
