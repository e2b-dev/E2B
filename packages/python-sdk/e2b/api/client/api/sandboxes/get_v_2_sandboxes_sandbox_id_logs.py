from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.logs_direction import LogsDirection
from ...models.sandbox_logs_v2_response import SandboxLogsV2Response
from ...types import UNSET, Response, Unset


def _get_kwargs(
    sandbox_id: str,
    *,
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
    direction: Union[Unset, LogsDirection] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_direction: Union[Unset, str] = UNSET
    if not isinstance(direction, Unset):
        json_direction = direction.value

    params["direction"] = json_direction

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/v2/sandboxes/{sandbox_id}/logs",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, SandboxLogsV2Response]]:
    if response.status_code == 200:
        response_200 = SandboxLogsV2Response.from_dict(response.json())

        return response_200
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
) -> Response[Union[Error, SandboxLogsV2Response]]:
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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
    direction: Union[Unset, LogsDirection] = UNSET,
) -> Response[Union[Error, SandboxLogsV2Response]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SandboxLogsV2Response]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        cursor=cursor,
        limit=limit,
        direction=direction,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
    direction: Union[Unset, LogsDirection] = UNSET,
) -> Optional[Union[Error, SandboxLogsV2Response]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SandboxLogsV2Response]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
        cursor=cursor,
        limit=limit,
        direction=direction,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
    direction: Union[Unset, LogsDirection] = UNSET,
) -> Response[Union[Error, SandboxLogsV2Response]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SandboxLogsV2Response]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        cursor=cursor,
        limit=limit,
        direction=direction,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
    direction: Union[Unset, LogsDirection] = UNSET,
) -> Optional[Union[Error, SandboxLogsV2Response]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SandboxLogsV2Response]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            cursor=cursor,
            limit=limit,
            direction=direction,
        )
    ).parsed
