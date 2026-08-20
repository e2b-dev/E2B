from datetime import datetime, timezone
from http import HTTPStatus
from uuid import uuid4

import pytest

from e2b import Secret
from e2b.api.client.models.secret import Secret as SecretModel
from e2b.api.client.models.secret_metadata import SecretMetadata
from e2b.api.client.types import UNSET, Response
from e2b.exceptions import SecretNotFoundException
import e2b.api.client.api.secrets.delete_secrets_secret_id as delete_secret_mod
import e2b.api.client.api.secrets.get_secrets as get_secrets_mod
import e2b.api.client.api.secrets.get_secrets_secret_id as get_secret_mod
import e2b.api.client.api.secrets.post_secrets as post_secrets_mod
import e2b.api.client.api.secrets.post_secrets_secret_id as update_secret_mod

# In-memory store for mock secrets
_secrets: dict[str, SecretModel] = {}


def _find_secret(selector: str):
    secret = _secrets.get(selector)
    if secret is not None:
        return secret
    return next((s for s in _secrets.values() if s.name == selector), None)


def _not_found():
    return Response(
        status_code=HTTPStatus(404),
        content=b"",
        headers={},
        parsed=None,
    )


@pytest.fixture(autouse=True)
def mock_secret_api(monkeypatch, test_api_key):
    monkeypatch.setenv("E2B_API_KEY", test_api_key)
    _secrets.clear()

    def mock_post_secrets(*, client, body):
        now = datetime.now(timezone.utc)
        metadata = SecretMetadata()
        if body.metadata is not UNSET:
            metadata = body.metadata
        secret = SecretModel(
            secret_id=f"sec_{uuid4()}",
            name=body.name.lower(),
            current_version=1,
            metadata=metadata,
            created_at=now,
            updated_at=now,
        )
        _secrets[secret.secret_id] = secret
        return Response(
            status_code=HTTPStatus(201),
            content=b"",
            headers={},
            parsed=secret,
        )

    def mock_get_secrets(*, client, limit=UNSET, next_token=UNSET):
        secrets = list(_secrets.values())
        page_size = limit if isinstance(limit, int) else 100
        start = int(next_token) if isinstance(next_token, str) else 0
        page = secrets[start : start + page_size]
        headers = {}
        if start + page_size < len(secrets):
            headers["x-next-token"] = str(start + page_size)
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers=headers,
            parsed=page,
        )

    def mock_get_secret(secret_id, *, client):
        secret = _find_secret(secret_id)
        if secret is None:
            return _not_found()
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers={},
            parsed=secret,
        )

    def mock_update_secret(secret_id, *, client, body):
        secret = _find_secret(secret_id)
        if secret is None:
            return _not_found()
        secret.current_version += 1
        if body.metadata is not UNSET:
            secret.metadata = body.metadata
        secret.updated_at = datetime.now(timezone.utc)
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers={},
            parsed=secret,
        )

    def mock_delete_secret(secret_id, *, client):
        secret = _find_secret(secret_id)
        if secret is None:
            return _not_found()
        del _secrets[secret.secret_id]
        return Response(
            status_code=HTTPStatus(204),
            content=b"",
            headers={},
            parsed=None,
        )

    monkeypatch.setattr(post_secrets_mod, "sync_detailed", mock_post_secrets)
    monkeypatch.setattr(get_secrets_mod, "sync_detailed", mock_get_secrets)
    monkeypatch.setattr(get_secret_mod, "sync_detailed", mock_get_secret)
    monkeypatch.setattr(update_secret_mod, "sync_detailed", mock_update_secret)
    monkeypatch.setattr(delete_secret_mod, "sync_detailed", mock_delete_secret)


def test_create_secret():
    info = Secret.create("openai-api-key", "sk-test", metadata={"env": "test"})

    assert info.secret_id.startswith("sec_")
    assert info.name == "openai-api-key"
    assert info.version == 1
    assert info.metadata == {"env": "test"}
    assert isinstance(info.created_at, datetime)
    assert isinstance(info.updated_at, datetime)
    assert not hasattr(info, "value")


def test_update_secret():
    created = Secret.create("rotating-key", "v1")
    updated = Secret.update(created.secret_id, "v2")

    assert updated.secret_id == created.secret_id
    assert updated.version == 2


def test_update_nonexistent_secret():
    with pytest.raises(SecretNotFoundException):
        Secret.update("missing", "value")


def test_get_secret_info():
    created = Secret.create("lookup-key", "value")

    by_id = Secret.get_info(created.secret_id)
    assert by_id.name == "lookup-key"

    by_name = Secret.get_info("lookup-key")
    assert by_name.secret_id == created.secret_id


def test_get_info_nonexistent_secret():
    with pytest.raises(SecretNotFoundException):
        Secret.get_info("missing")


def test_list_secrets_with_pagination():
    Secret.create("key-a", "a")
    Secret.create("key-b", "b")
    Secret.create("key-c", "c")

    paginator = Secret.list(limit=2)
    first_page = paginator.next_items()
    assert len(first_page) == 2
    assert paginator.has_next is True

    second_page = paginator.next_items()
    assert len(second_page) == 1
    assert paginator.has_next is False


def test_secret_exists():
    Secret.create("present-key", "value")

    assert Secret.exists("present-key") is True
    assert Secret.exists("absent-key") is False


def test_destroy_secret():
    created = Secret.create("to-delete", "value")

    assert Secret.destroy(created.secret_id) is True
    assert Secret.exists(created.secret_id) is False


def test_destroy_nonexistent_secret():
    assert Secret.destroy("missing") is False


def test_fill():
    assert Secret.fill("openai-api-key") == "${e2b.secrets.openai-api-key}"
