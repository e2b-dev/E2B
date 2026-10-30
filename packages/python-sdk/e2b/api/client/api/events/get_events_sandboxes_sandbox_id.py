from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sandbox_event import SandboxEvent
from ...types import UNSET, Response, Unset


def _get_kwargs(
    sandbox_id: str,
    *,
    offset: Union[Unset, int] = 0,
    limit: Union[Unset, int] = 10,
    order_asc: Union[Unset, bool] = False,
    types: Union[Unset, list[str]] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["offset"] = offset

    params["limit"] = limit

    params["orderAsc"] = order_asc

    json_types: Union[Unset, list[str]] = UNSET
    if not isinstance(types, Unset):
        json_types = types

    params["types"] = json_types

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/events/sandboxes/{sandbox_id}",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["SandboxEvent"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = SandboxEvent.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
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
) -> Response[Union[Error, list["SandboxEvent"]]]:
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
    offset: Union[Unset, int] = 0,
    limit: Union[Unset, int] = 10,
    order_asc: Union[Unset, bool] = False,
    types: Union[Unset, list[str]] = UNSET,
) -> Response[Union[Error, list["SandboxEvent"]]]:
    """Get sandbox events

    Args:
        sandbox_id (str):
        offset (Union[Unset, int]):  Default: 0.
        limit (Union[Unset, int]):  Default: 10.
        order_asc (Union[Unset, bool]):  Default: False.
        types (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxEvent']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        offset=offset,
        limit=limit,
        order_asc=order_asc,
        types=types,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    offset: Union[Unset, int] = 0,
    limit: Union[Unset, int] = 10,
    order_asc: Union[Unset, bool] = False,
    types: Union[Unset, list[str]] = UNSET,
) -> Optional[Union[Error, list["SandboxEvent"]]]:
    """Get sandbox events

    Args:
        sandbox_id (str):
        offset (Union[Unset, int]):  Default: 0.
        limit (Union[Unset, int]):  Default: 10.
        order_asc (Union[Unset, bool]):  Default: False.
        types (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxEvent']]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
        offset=offset,
        limit=limit,
        order_asc=order_asc,
        types=types,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    offset: Union[Unset, int] = 0,
    limit: Union[Unset, int] = 10,
    order_asc: Union[Unset, bool] = False,
    types: Union[Unset, list[str]] = UNSET,
) -> Response[Union[Error, list["SandboxEvent"]]]:
    """Get sandbox events

    Args:
        sandbox_id (str):
        offset (Union[Unset, int]):  Default: 0.
        limit (Union[Unset, int]):  Default: 10.
        order_asc (Union[Unset, bool]):  Default: False.
        types (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxEvent']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        offset=offset,
        limit=limit,
        order_asc=order_asc,
        types=types,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    offset: Union[Unset, int] = 0,
    limit: Union[Unset, int] = 10,
    order_asc: Union[Unset, bool] = False,
    types: Union[Unset, list[str]] = UNSET,
) -> Optional[Union[Error, list["SandboxEvent"]]]:
    """Get sandbox events

    Args:
        sandbox_id (str):
        offset (Union[Unset, int]):  Default: 0.
        limit (Union[Unset, int]):  Default: 10.
        order_asc (Union[Unset, bool]):  Default: False.
        types (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxEvent']]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            offset=offset,
            limit=limit,
            order_asc=order_asc,
            types=types,
        )
    ).parsed
