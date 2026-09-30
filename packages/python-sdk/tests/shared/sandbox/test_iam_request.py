from types import SimpleNamespace
from typing import Any, Dict, cast
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, Sandbox, Secret
from e2b.api.client.api.sandboxes import post_v2_sandboxes
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.exceptions import InvalidArgumentException

AWS_TOKEN_BODY = {
    "tokens": {
        "aws": {"audience": "sts.amazonaws.com", "tokenType": "JWT-SVID"},
    },
}


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="sbx-test",
            template_id="template-id",
        ),
    )


def _sync_create_body(monkeypatch, api_key: str, iam) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, iam=iam)

    return request.call_args.kwargs["body"].to_dict()


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(
            {"audience": "sts.amazonaws.com", "token_type": "JWT-SVID"}, id="dict"
        ),
        pytest.param(
            Secret.iam_token(audience="sts.amazonaws.com", token_type="JWT-SVID"),
            id="secret-iam-token",
        ),
    ],
)
def test_create_sends_iam_tokens(monkeypatch, test_api_key, token):
    body = _sync_create_body(monkeypatch, test_api_key, {"tokens": {"aws": token}})

    assert body["iam"] == AWS_TOKEN_BODY


async def test_async_create_sends_iam_tokens(monkeypatch, test_api_key):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(
        api_key=test_api_key,
        iam={
            "tokens": {
                "aws": {"audience": "sts.amazonaws.com", "token_type": "JWT-SVID"}
            }
        },
    )

    assert request.call_args.kwargs["body"].to_dict()["iam"] == AWS_TOKEN_BODY


@pytest.mark.parametrize(
    "iam",
    [
        pytest.param(None, id="not-provided"),
        pytest.param({}, id="empty"),
        pytest.param({"tokens": {}}, id="empty-tokens"),
    ],
)
def test_create_omits_an_empty_iam_config(monkeypatch, test_api_key, iam):
    body = _sync_create_body(monkeypatch, test_api_key, iam)

    assert "iam" not in body


@pytest.mark.parametrize(
    "token",
    [
        # The wire-format casing a user might copy from the JS example or a
        # serialized payload must fail with an actionable error, not a KeyError.
        pytest.param(
            {"audience": "sts.amazonaws.com", "tokenType": "JWT-SVID"},
            id="camel-case-token-type",
        ),
        pytest.param(None, id="none"),
        # Non-string values must be rejected too, not serialized as null.
        pytest.param({"audience": None, "token_type": "JWT-SVID"}, id="none-audience"),
    ],
)
def test_create_rejects_a_malformed_iam_token(monkeypatch, test_api_key, token):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match="token_type"):
        Sandbox.create(api_key=test_api_key, iam=cast(Any, {"tokens": {"aws": token}}))

    request.assert_not_called()
