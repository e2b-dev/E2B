from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.secret import Secret
from ...types import Response


def _get_kwargs(
    secret_id: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/secrets/{secret_id}",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, Secret]]:
    if response.status_code == 200:
        response_200 = Secret.from_dict(response.json())

        return response_200
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 403:
        response_403 = Error.from_dict(response.json())

        return response_403
    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404
    if response.status_code == 409:
        response_409 = Error.from_dict(response.json())

        return response_409
    if response.status_code == 429:
        response_429 = Error.from_dict(response.json())

        return response_429
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if response.status_code == 502:
        response_502 = Error.from_dict(response.json())

        return response_502
    if response.status_code == 504:
        response_504 = Error.from_dict(response.json())

        return response_504
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, Secret]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    secret_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, Secret]]:
    """Get a secret

     Get one secret's metadata, selected by identifier or name.

    Args:
        secret_id (str): Identifier of the secret (sec_ prefixed), or its canonical lower-case
            name

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, Secret]]
    """

    kwargs = _get_kwargs(
        secret_id=secret_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    secret_id: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, Secret]]:
    """Get a secret

     Get one secret's metadata, selected by identifier or name.

    Args:
        secret_id (str): Identifier of the secret (sec_ prefixed), or its canonical lower-case
            name

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, Secret]
    """

    return sync_detailed(
        secret_id=secret_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    secret_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, Secret]]:
    """Get a secret

     Get one secret's metadata, selected by identifier or name.

    Args:
        secret_id (str): Identifier of the secret (sec_ prefixed), or its canonical lower-case
            name

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, Secret]]
    """

    kwargs = _get_kwargs(
        secret_id=secret_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    secret_id: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, Secret]]:
    """Get a secret

     Get one secret's metadata, selected by identifier or name.

    Args:
        secret_id (str): Identifier of the secret (sec_ prefixed), or its canonical lower-case
            name

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, Secret]
    """

    return (
        await asyncio_detailed(
            secret_id=secret_id,
            client=client,
        )
    ).parsed
