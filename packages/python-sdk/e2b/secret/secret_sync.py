from typing import Dict, List, Optional

from typing_extensions import Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.secrets import (
    delete_secrets_secret_id,
    get_secrets,
    get_secrets_secret_id,
    post_secrets,
    post_secrets_secret_id,
)
from e2b.api.client.models import (
    Error,
    NewSecret as NewSecretModel,
    SecretMetadata as SecretMetadataModel,
    SecretUpdate as SecretUpdateModel,
)
from e2b.api.client.types import UNSET
from e2b.api.client_sync import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import SecretException, SecretNotFoundException
from e2b.secret.base import SecretBase, SecretPaginatorBase
from e2b.secret.types import SecretInfo


def _metadata_model(metadata: Optional[Dict[str, str]]) -> SecretMetadataModel:
    model = SecretMetadataModel()
    if metadata:
        model.additional_properties = dict(metadata)
    return model


class SecretPaginator(SecretPaginatorBase):
    """
    Paginator for listing secrets.

    Example:
    ```python
    paginator = Secret.list()

    while paginator.has_next:
        secrets = paginator.next_items()
        print(secrets)
    ```
    """

    def next_items(self, **opts: Unpack[ApiParams]) -> List[SecretInfo]:
        """
        Returns the next page of secrets.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options instead of the ones the paginator was constructed with.

        :return: List of secret metadata.
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        config = ConnectionConfig(**{**self._opts, **opts})
        api_client = get_api_client(config)
        res = get_secrets.sync_detailed(
            client=api_client,
            limit=self.limit if self.limit else UNSET,
            next_token=self._next_token if self._next_token else UNSET,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res, SecretException)

        self._update_pagination(res.headers)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise SecretException(f"{res.parsed.message}: Request failed")

        return [SecretInfo._from_model(secret) for secret in res.parsed]


class Secret(SecretBase):
    """
    Module for managing E2B secrets and workload identity helpers.

    Secret values are write-only: they are accepted by ``create`` and
    ``update`` but never returned by any read surface.
    """

    @staticmethod
    def create(
        name: str,
        value: str,
        metadata: Optional[Dict[str, str]] = None,
        **opts: Unpack[ApiParams],
    ) -> SecretInfo:
        """
        Create a new secret and its first value.

        :param name: Name of the secret, unique within the project.
        :param value: Secret value. Write-only — never returned by the API.
        :param metadata: Customer metadata to store with the secret.

        :return: Metadata of the created secret.
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)
        res = post_secrets.sync_detailed(
            client=api_client,
            body=NewSecretModel(
                name=name,
                value=value,
                metadata=_metadata_model(metadata) if metadata else UNSET,
            ),
        )

        if res.status_code >= 300:
            raise handle_api_exception(res, SecretException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SecretException(f"{res.parsed.message}: Request failed")

        return SecretInfo._from_model(res.parsed)

    @staticmethod
    def update(
        secret: str,
        value: str,
        metadata: Optional[Dict[str, str]] = None,
        **opts: Unpack[ApiParams],
    ) -> SecretInfo:
        """
        Update a secret's value by storing it as the secret's new version.

        :param secret: Secret ID or name.
        :param value: New secret value. Write-only — never returned by the API.
        :param metadata: Customer metadata to store with the secret. When
            provided, replaces the stored metadata.

        :return: Metadata of the updated secret.
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)
        res = post_secrets_secret_id.sync_detailed(
            secret,
            client=api_client,
            body=SecretUpdateModel(
                value=value,
                metadata=_metadata_model(metadata) if metadata else UNSET,
            ),
        )

        if res.status_code == 404:
            raise SecretNotFoundException(f"Secret {secret} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, SecretException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SecretException(f"{res.parsed.message}: Request failed")

        return SecretInfo._from_model(res.parsed)

    @staticmethod
    def get_info(secret: str, **opts: Unpack[ApiParams]) -> SecretInfo:
        """
        Get a secret's metadata.

        :param secret: Secret ID or name.

        :return: Metadata of the secret.
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)
        res = get_secrets_secret_id.sync_detailed(
            secret,
            client=api_client,
        )

        if res.status_code == 404:
            raise SecretNotFoundException(f"Secret {secret} not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, SecretException)

        if res.parsed is None:
            raise Exception("Body of the request is None")

        if isinstance(res.parsed, Error):
            raise SecretException(f"{res.parsed.message}: Request failed")

        return SecretInfo._from_model(res.parsed)

    @staticmethod
    def list(
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ) -> SecretPaginator:
        """
        List the project's secrets.

        :param limit: Number of secrets to return per page.
        :param next_token: Token to the next page.

        :return: Paginator of secret metadata.
        """
        return SecretPaginator(limit=limit, next_token=next_token, **opts)

    @staticmethod
    def exists(secret: str, **opts: Unpack[ApiParams]) -> bool:
        """
        Check whether a secret exists.

        :param secret: Secret ID or name.

        :return: `True` if the secret exists, `False` otherwise.
        """
        try:
            Secret.get_info(secret, **opts)
            return True
        except SecretNotFoundException:
            return False

    @staticmethod
    def destroy(secret: str, **opts: Unpack[ApiParams]) -> bool:
        """
        Destroy a secret, making all its versions inaccessible.

        :param secret: Secret ID or name.

        :return: `True` if the secret was destroyed, `False` if it was not found.
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(config)
        res = delete_secrets_secret_id.sync_detailed(
            secret,
            client=api_client,
        )

        if res.status_code == 404:
            return False

        if res.status_code >= 300:
            raise handle_api_exception(res, SecretException)

        return True
