from typing import Any, Callable, Dict
from urllib.parse import parse_qs, urlsplit

import pytest

from e2b import InvalidArgumentException
from sdk_flavours import Sdk, result

# Arguments the API never sees as they were given: the SDK turns them into a
# URL or a request field first. Each is refused before a request is sent, which
# the tests read off `backend`, a local server in place of the API.

NO_PATH_SEGMENT = ["", ".", ".."]

UNSENDABLE_KEY = (
    "Invalid idempotency_key: expected a non-empty string of printable ASCII "
    "characters that does not start or end with a space."
)


# --- names in the request path


NAMED_CALLS: Dict[str, Callable[[Sdk, str, Dict[str, Any]], Any]] = {
    "Template.exists": lambda sdk, name, opts: sdk.Template.exists(name, **opts),
    "Template.get_tags": lambda sdk, name, opts: sdk.Template.get_tags(name, **opts),
}


@pytest.mark.parametrize("name", NO_PATH_SEGMENT)
@pytest.mark.parametrize("call", NAMED_CALLS.values(), ids=NAMED_CALLS.keys())
async def test_a_name_that_is_no_path_segment_is_refused(
    sdk, backend, opts, call, name
):
    with pytest.raises(InvalidArgumentException):
        await result(call(sdk, name, opts))

    assert backend.sent == []


# --- network options


@pytest.mark.parametrize("field", ["allow_out", "deny_out"])
async def test_create_refuses_a_selector_callable_that_returns_nothing(
    sdk, backend, opts, field
):
    with pytest.raises(InvalidArgumentException, match=field):
        await result(sdk.Sandbox.create(network={field: lambda ctx: None}, **opts))

    assert backend.sent == []


@pytest.mark.parametrize("field", ["allow_out", "deny_out", "dns_servers"])
async def test_create_does_not_read_a_string_as_a_list_of_its_characters(
    sdk, backend, opts, field
):
    with pytest.raises(InvalidArgumentException, match=field):
        await result(sdk.Sandbox.create(network={field: "example.com"}, **opts))

    assert backend.sent == []


@pytest.mark.parametrize("field", ["allow_out", "deny_out", "dns_servers"])
async def test_update_network_does_not_read_a_string_as_a_list_of_its_characters(
    sdk, backend, opts, field
):
    with pytest.raises(InvalidArgumentException, match=field):
        await result(
            sdk.Sandbox.update_network("sbx-test", {field: "example.com"}, **opts)
        )

    assert backend.sent == []


async def test_create_sends_what_a_selector_callable_returns(sdk, backend, opts):
    await result(
        sdk.Sandbox.create(
            network={
                "deny_out": lambda ctx: (ctx.all_traffic,),
                "allow_out": ["1.1.1.1"],
            },
            **opts,
        )
    )

    assert backend.requests[0].json()["network"] == {
        "denyOut": ["0.0.0.0/0"],
        "allowOut": ["1.1.1.1"],
    }


# --- string maps


@pytest.mark.parametrize("field", ["envs", "metadata"])
async def test_create_refuses_a_missing_map_value(sdk, backend, opts, field):
    values = {"KEPT": "value", "MISSING": None}

    with pytest.raises(InvalidArgumentException, match="MISSING"):
        await result(sdk.Sandbox.create(**{field: values}, **opts))

    assert backend.sent == []


@pytest.mark.parametrize("as_callable", [False, True], ids=["dict", "callable"])
async def test_create_refuses_a_transform_header_without_a_value(
    sdk, backend, opts, as_callable
):
    transform: Any = {"headers": {"Authorization": None}}
    rule = {"transform": (lambda ctx: transform) if as_callable else transform}

    with pytest.raises(InvalidArgumentException, match="Authorization"):
        await result(
            sdk.Sandbox.create(network={"rules": {"api.example.com": [rule]}}, **opts)
        )

    assert backend.sent == []


# --- values that are falsy but not missing


async def test_list_sends_a_limit_of_zero_for_the_api_to_refuse(sdk, backend, opts):
    await result(sdk.Sandbox.list(limit=0, **opts).next_items())

    query = parse_qs(urlsplit(backend.requests[0].path).query)
    assert query["limit"] == ["0"]


async def test_create_sends_an_empty_template_name_for_the_api_to_refuse(
    sdk, backend, opts
):
    await result(sdk.Sandbox.create("", **opts))

    assert backend.requests[0].json()["templateID"] == ""


# --- idempotency key


@pytest.mark.parametrize("key", ["", " abc ", "abc ", "界", "a\nb"])
async def test_create_refuses_an_idempotency_key_the_api_would_not_see_as_given(
    sdk, backend, opts, key
):
    with pytest.raises(InvalidArgumentException) as error:
        await result(sdk.Sandbox.create(idempotency_key=key, **opts))

    assert (str(error.value), backend.sent) == (UNSENDABLE_KEY, [])


# Which keys are accepted (length, characters) is the API's rule.
@pytest.mark.parametrize("key", ["a" * 256, "ABC", "abc_1"])
async def test_create_sends_an_idempotency_key_for_the_api_to_judge(
    sdk, backend, opts, key
):
    await result(sdk.Sandbox.create(idempotency_key=key, **opts))

    assert backend.requests[0].headers["idempotency-key"] == key
