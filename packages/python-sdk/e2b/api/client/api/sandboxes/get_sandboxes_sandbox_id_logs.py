from http import HTTPStatus
from typing import Any, Dict, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.sandbox_logs import SandboxLogs
from ...types import UNSET, Response, Unset


def _get_kwargs(
    sandbox_id: str,
    *,
    start: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    params["start"] = start

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: Dict[str, Any] = {
        "method": "get",
        "url": f"/sandboxes/{sandbox_id}/logs",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, SandboxLogs]]:
    if response.status_code == HTTPStatus.OK:
        response_200 = SandboxLogs.from_dict(response.json())

        return response_200
    if response.status_code == HTTPStatus.UNAUTHORIZED:
        response_401 = cast(Any, None)
        return response_401
    if response.status_code == HTTPStatus.NOT_FOUND:
        response_404 = cast(Any, None)
        return response_404
    if response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR:
        response_500 = cast(Any, None)
        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Any, SandboxLogs]]:
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
    start: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Response[Union[Any, SandboxLogs]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, SandboxLogs]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        start=start,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Optional[Union[Any, SandboxLogs]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, SandboxLogs]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
        start=start,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Response[Union[Any, SandboxLogs]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, SandboxLogs]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        start=start,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Optional[Union[Any, SandboxLogs]]:
    """Get sandbox logs

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, SandboxLogs]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            start=start,
            limit=limit,
        )
    ).parsed
