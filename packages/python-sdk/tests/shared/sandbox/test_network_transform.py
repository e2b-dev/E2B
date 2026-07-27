from typing import Any, cast

import pytest

from e2b import SandboxNetworkOpts, Secret
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import (
    build_iam_config,
    build_network_config,
    build_network_update_body,
)


def _aws_iam():
    return build_iam_config(
        {
            "tokens": {
                "aws": Secret.iam_token(
                    audience="sts.amazonaws.com", token_type="JWT-SVID"
                ),
            },
        }
    )


def test_transform_callable_resolves_iam_token_placeholder():
    network: SandboxNetworkOpts = {
        "allow_out": lambda ctx: list(ctx.rules.keys()),
        "rules": {
            "api.internal.example.com": [
                {
                    "transform": lambda ctx: {
                        "headers": {
                            "Authorization": f"Bearer {ctx.iam.tokens['aws']}",
                        },
                    },
                },
            ],
        },
    }

    body = build_network_config(network, _aws_iam())
    assert body is not None
    assert body["allow_out"] == ["api.internal.example.com"]
    # The SDK never resolves the placeholder — the egress proxy substitutes a
    # freshly minted token per request.
    assert body["rules"].to_dict() == {
        "api.internal.example.com": [
            {
                "transform": {
                    "headers": {
                        "Authorization": "Bearer ${e2b.identity.tokens.aws}",
                    },
                },
            },
        ],
    }


def test_transform_callable_sees_every_registered_iam_token():
    token = Secret.iam_token(audience="sts.amazonaws.com", token_type="JWT-SVID")
    iam = build_iam_config({"tokens": {"aws": token, "gcp": token}})

    network: SandboxNetworkOpts = {
        "rules": {
            "api.internal.example.com": [
                {
                    "transform": lambda ctx: {
                        "headers": {
                            "X-Tokens": ",".join(ctx.iam.tokens),
                            # Membership answers "is it registered?" without
                            # raising, so a callable can branch on it.
                            "X-Has-Aws": str("aws" in ctx.iam.tokens),
                            "X-Has-Gh": str("gh" in ctx.iam.tokens),
                        },
                    },
                },
            ],
        },
    }

    body = build_network_config(network, iam)
    assert body is not None
    assert body["rules"].to_dict() == {
        "api.internal.example.com": [
            {
                "transform": {
                    "headers": {
                        "X-Tokens": "aws,gcp",
                        "X-Has-Aws": "True",
                        "X-Has-Gh": "False",
                    },
                },
            },
        ],
    }


def test_static_transform_is_sent_unchanged():
    network: SandboxNetworkOpts = {
        "rules": {
            "api.openai.com": [
                {"transform": {"headers": {"Authorization": "Bearer static"}}},
            ],
        },
    }

    body = build_network_config(network)
    assert body is not None
    assert body["rules"].to_dict() == {
        "api.openai.com": [
            {"transform": {"headers": {"Authorization": "Bearer static"}}},
        ],
    }


def _typo_network(access) -> Any:
    return cast(
        Any,
        {
            "rules": {
                "api.internal.example.com": [
                    {
                        "transform": lambda ctx: {
                            "headers": {"Authorization": f"Bearer {access(ctx)}"},
                        },
                    },
                ],
            },
        },
    )


@pytest.mark.parametrize(
    "access",
    [
        # Every lookup form must reject an unregistered name — `.get()` returning
        # None would ship the literal header "Bearer None".
        pytest.param(lambda ctx: ctx.iam.tokens["awz"], id="getitem"),
        pytest.param(lambda ctx: ctx.iam.tokens.get("awz"), id="get"),
        # A name that shadows an object member is not a registered token either;
        # the JS SDK checks own keys only for the same reason.
        pytest.param(lambda ctx: ctx.iam.tokens["keys"], id="dunder-lookalike"),
    ],
)
def test_transform_callable_rejects_unregistered_iam_token(access):
    # The proxy never turns an unregistered name into a token, so a typo would
    # surface as a confusing auth failure at the destination.
    with pytest.raises(InvalidArgumentException, match="Registered tokens: 'aws'"):
        build_network_config(_typo_network(access), _aws_iam())

    # Same rule without any iam config at all.
    with pytest.raises(InvalidArgumentException, match="not registered"):
        build_network_config(_typo_network(access))


@pytest.mark.parametrize(
    "returned",
    [
        pytest.param(None, id="none"),
        pytest.param("headers", id="str"),
        pytest.param([{"headers": {}}], id="list"),
    ],
)
def test_transform_callable_returning_a_non_transform_is_rejected(returned):
    # Untyped callers can forget the return value or return the wrong shape; the
    # rule would otherwise be created without the headers it exists for.
    network = cast(
        Any,
        {
            "rules": {
                "api.internal.example.com": [{"transform": lambda ctx: returned}]
            },
        },
    )

    with pytest.raises(InvalidArgumentException, match="must return a transform dict"):
        build_network_config(network)


def test_async_transform_callable_is_rejected():
    async def transform(ctx):
        return {"headers": {"Authorization": "Bearer late"}}

    network = cast(
        Any,
        {"rules": {"api.internal.example.com": [{"transform": transform}]}},
    )

    with pytest.raises(InvalidArgumentException, match="must be synchronous"):
        build_network_config(network)


def test_update_network_resolves_transform_callables_without_iam():
    # The update payload carries no iam config, so the sandbox's registered
    # token names are unknown client-side and any name resolves to its
    # placeholder.
    body = build_network_update_body(
        {
            "allow_out": lambda ctx: list(ctx.rules.keys()),
            "rules": {
                "api.internal.example.com": [
                    {
                        "transform": lambda ctx: {
                            "headers": {
                                "Authorization": f"Bearer {ctx.iam.tokens['aws']}",
                                "X-Also": f"{ctx.iam.tokens.get('gcp')}",
                            },
                        },
                    },
                ],
            },
        }
    )

    assert body.to_dict() == {
        "allowOut": ["api.internal.example.com"],
        "rules": {
            "api.internal.example.com": [
                {
                    "transform": {
                        "headers": {
                            "Authorization": "Bearer ${e2b.identity.tokens.aws}",
                            "X-Also": "${e2b.identity.tokens.gcp}",
                        },
                    },
                },
            ],
        },
    }
