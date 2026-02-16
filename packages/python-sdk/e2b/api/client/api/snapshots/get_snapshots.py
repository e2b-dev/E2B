from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.snapshot_info import SnapshotInfo
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    sandbox_id: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = UNSET,
    next_token: Union[Unset, str] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["sandboxID"] = sandbox_id

    params["limit"] = limit

    params["nextToken"] = next_token

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/snapshots",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["SnapshotInfo"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = SnapshotInfo.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, list["SnapshotInfo"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    sandbox_id: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = UNSET,
    next_token: Union[Unset, str] = UNSET,
) -> Response[Union[Error, list["SnapshotInfo"]]]:
    """List all snapshots for the team

    Args:
        sandbox_id (Union[Unset, str]):
        limit (Union[Unset, int]):
        next_token (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SnapshotInfo']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        limit=limit,
        next_token=next_token,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    sandbox_id: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = UNSET,
    next_token: Union[Unset, str] = UNSET,
) -> Optional[Union[Error, list["SnapshotInfo"]]]:
    """List all snapshots for the team

    Args:
        sandbox_id (Union[Unset, str]):
        limit (Union[Unset, int]):
        next_token (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SnapshotInfo']]
    """

    return sync_detailed(
        client=client,
        sandbox_id=sandbox_id,
        limit=limit,
        next_token=next_token,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    sandbox_id: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = UNSET,
    next_token: Union[Unset, str] = UNSET,
) -> Response[Union[Error, list["SnapshotInfo"]]]:
    """List all snapshots for the team

    Args:
        sandbox_id (Union[Unset, str]):
        limit (Union[Unset, int]):
        next_token (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SnapshotInfo']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        limit=limit,
        next_token=next_token,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    sandbox_id: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = UNSET,
    next_token: Union[Unset, str] = UNSET,
) -> Optional[Union[Error, list["SnapshotInfo"]]]:
    """List all snapshots for the team

    Args:
        sandbox_id (Union[Unset, str]):
        limit (Union[Unset, int]):
        next_token (Union[Unset, str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SnapshotInfo']]
    """

    return (
        await asyncio_detailed(
            client=client,
            sandbox_id=sandbox_id,
            limit=limit,
            next_token=next_token,
        )
    ).parsed
