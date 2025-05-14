from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.listed_sandbox import ListedSandbox
from ...models.sandbox_state import SandboxState
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    metadata: Union[Unset, str] = UNSET,
    state: Union[Unset, list[SandboxState]] = UNSET,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["metadata"] = metadata

    json_state: Union[Unset, list[str]] = UNSET
    if not isinstance(state, Unset):
        json_state = []
        for state_item_data in state:
            state_item = state_item_data.value
            json_state.append(state_item)

    params["state"] = json_state

    params["nextToken"] = next_token

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/v2/sandboxes",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["ListedSandbox"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = ListedSandbox.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
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
) -> Response[Union[Error, list["ListedSandbox"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    metadata: Union[Unset, str] = UNSET,
    state: Union[Unset, list[SandboxState]] = UNSET,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Response[Union[Error, list["ListedSandbox"]]]:
    """List all sandboxes

    Args:
        metadata (Union[Unset, str]):
        state (Union[Unset, list[SandboxState]]):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['ListedSandbox']]]
    """

    kwargs = _get_kwargs(
        metadata=metadata,
        state=state,
        next_token=next_token,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    metadata: Union[Unset, str] = UNSET,
    state: Union[Unset, list[SandboxState]] = UNSET,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Optional[Union[Error, list["ListedSandbox"]]]:
    """List all sandboxes

    Args:
        metadata (Union[Unset, str]):
        state (Union[Unset, list[SandboxState]]):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['ListedSandbox']]
    """

    return sync_detailed(
        client=client,
        metadata=metadata,
        state=state,
        next_token=next_token,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    metadata: Union[Unset, str] = UNSET,
    state: Union[Unset, list[SandboxState]] = UNSET,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Response[Union[Error, list["ListedSandbox"]]]:
    """List all sandboxes

    Args:
        metadata (Union[Unset, str]):
        state (Union[Unset, list[SandboxState]]):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['ListedSandbox']]]
    """

    kwargs = _get_kwargs(
        metadata=metadata,
        state=state,
        next_token=next_token,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    metadata: Union[Unset, str] = UNSET,
    state: Union[Unset, list[SandboxState]] = UNSET,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 1000,
) -> Optional[Union[Error, list["ListedSandbox"]]]:
    """List all sandboxes

    Args:
        metadata (Union[Unset, str]):
        state (Union[Unset, list[SandboxState]]):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 1000.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['ListedSandbox']]
    """

    return (
        await asyncio_detailed(
            client=client,
            metadata=metadata,
            state=state,
            next_token=next_token,
            limit=limit,
        )
    ).parsed
