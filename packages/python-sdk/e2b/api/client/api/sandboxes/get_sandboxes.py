from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.get_sandboxes_state import GetSandboxesState
from ...models.listed_sandbox import ListedSandbox
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    query: Union[Unset, str] = UNSET,
    state: Union[Unset, GetSandboxesState] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["query"] = query

    json_state: Union[Unset, str] = UNSET
    if not isinstance(state, Unset):
        json_state = state

    params["state"] = json_state

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sandboxes",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, list["ListedSandbox"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = ListedSandbox.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
    if response.status_code == 400:
        response_400 = cast(Any, None)
        return response_400
    if response.status_code == 401:
        response_401 = cast(Any, None)
        return response_401
    if response.status_code == 500:
        response_500 = cast(Any, None)
        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Any, list["ListedSandbox"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    query: Union[Unset, str] = UNSET,
    state: Union[Unset, GetSandboxesState] = UNSET,
) -> Response[Union[Any, list["ListedSandbox"]]]:
    """List all running sandboxes

    Args:
        query (Union[Unset, str]):
        state (Union[Unset, GetSandboxesState]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, list['ListedSandbox']]]
    """

    kwargs = _get_kwargs(
        query=query,
        state=state,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    query: Union[Unset, str] = UNSET,
    state: Union[Unset, GetSandboxesState] = UNSET,
) -> Optional[Union[Any, list["ListedSandbox"]]]:
    """List all running sandboxes

    Args:
        query (Union[Unset, str]):
        state (Union[Unset, GetSandboxesState]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, list['ListedSandbox']]
    """

    return sync_detailed(
        client=client,
        query=query,
        state=state,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    query: Union[Unset, str] = UNSET,
    state: Union[Unset, GetSandboxesState] = UNSET,
) -> Response[Union[Any, list["ListedSandbox"]]]:
    """List all running sandboxes

    Args:
        query (Union[Unset, str]):
        state (Union[Unset, GetSandboxesState]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, list['ListedSandbox']]]
    """

    kwargs = _get_kwargs(
        query=query,
        state=state,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    query: Union[Unset, str] = UNSET,
    state: Union[Unset, GetSandboxesState] = UNSET,
) -> Optional[Union[Any, list["ListedSandbox"]]]:
    """List all running sandboxes

    Args:
        query (Union[Unset, str]):
        state (Union[Unset, GetSandboxesState]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, list['ListedSandbox']]
    """

    return (
        await asyncio_detailed(
            client=client,
            query=query,
            state=state,
        )
    ).parsed
