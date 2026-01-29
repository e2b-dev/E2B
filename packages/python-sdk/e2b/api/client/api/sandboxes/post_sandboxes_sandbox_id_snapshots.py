from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.snapshot_info import SnapshotInfo
from ...types import Response


def _get_kwargs(
    sandbox_id: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/sandboxes/{sandbox_id}/snapshots",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, SnapshotInfo]]:
    if response.status_code == 201:
        response_201 = SnapshotInfo.from_dict(response.json())

        return response_201
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, SnapshotInfo]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, SnapshotInfo]]:
    """Create a persistent snapshot from the sandbox's current state. Snapshots can be used to create new
    sandboxes and persist beyond the original sandbox's lifetime.

    Args:
        sandbox_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SnapshotInfo]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, SnapshotInfo]]:
    """Create a persistent snapshot from the sandbox's current state. Snapshots can be used to create new
    sandboxes and persist beyond the original sandbox's lifetime.

    Args:
        sandbox_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SnapshotInfo]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, SnapshotInfo]]:
    """Create a persistent snapshot from the sandbox's current state. Snapshots can be used to create new
    sandboxes and persist beyond the original sandbox's lifetime.

    Args:
        sandbox_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SnapshotInfo]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, SnapshotInfo]]:
    """Create a persistent snapshot from the sandbox's current state. Snapshots can be used to create new
    sandboxes and persist beyond the original sandbox's lifetime.

    Args:
        sandbox_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SnapshotInfo]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
        )
    ).parsed
