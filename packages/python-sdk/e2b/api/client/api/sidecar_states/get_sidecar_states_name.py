from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sidecar_state_detail import SidecarStateDetail
from ...types import Response


def _get_kwargs(
    name: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/sidecar-states/{name}",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, SidecarStateDetail]]:
    if response.status_code == 200:
        response_200 = SidecarStateDetail.from_dict(response.json())

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
) -> Response[Union[Error, SidecarStateDetail]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    name: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, SidecarStateDetail]]:
    """Get sidecar state

     Get one of the team's named sidecar states with every version kept under it. Rejections carry an
    error_code: sidecar_state_flag_off (400) and sidecar_state_unknown (404).

    Args:
        name (str): Name of a saved sidecar state, unique within the team

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SidecarStateDetail]]
    """

    kwargs = _get_kwargs(
        name=name,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    name: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, SidecarStateDetail]]:
    """Get sidecar state

     Get one of the team's named sidecar states with every version kept under it. Rejections carry an
    error_code: sidecar_state_flag_off (400) and sidecar_state_unknown (404).

    Args:
        name (str): Name of a saved sidecar state, unique within the team

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SidecarStateDetail]
    """

    return sync_detailed(
        name=name,
        client=client,
    ).parsed


async def asyncio_detailed(
    name: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, SidecarStateDetail]]:
    """Get sidecar state

     Get one of the team's named sidecar states with every version kept under it. Rejections carry an
    error_code: sidecar_state_flag_off (400) and sidecar_state_unknown (404).

    Args:
        name (str): Name of a saved sidecar state, unique within the team

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SidecarStateDetail]]
    """

    kwargs = _get_kwargs(
        name=name,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    name: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, SidecarStateDetail]]:
    """Get sidecar state

     Get one of the team's named sidecar states with every version kept under it. Rejections carry an
    error_code: sidecar_state_flag_off (400) and sidecar_state_unknown (404).

    Args:
        name (str): Name of a saved sidecar state, unique within the team

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SidecarStateDetail]
    """

    return (
        await asyncio_detailed(
            name=name,
            client=client,
        )
    ).parsed
