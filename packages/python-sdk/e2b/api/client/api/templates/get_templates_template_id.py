from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_with_builds import TemplateWithBuilds
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    *,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["nextToken"] = next_token

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateWithBuilds]]:
    if response.status_code == 200:
        response_200 = TemplateWithBuilds.from_dict(response.json())

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
) -> Response[Union[Error, TemplateWithBuilds]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
) -> Response[Union[Error, TemplateWithBuilds]]:
    """List all builds for a template

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateWithBuilds]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        next_token=next_token,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
) -> Optional[Union[Error, TemplateWithBuilds]]:
    """List all builds for a template

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateWithBuilds]
    """

    return sync_detailed(
        template_id=template_id,
        client=client,
        next_token=next_token,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
) -> Response[Union[Error, TemplateWithBuilds]]:
    """List all builds for a template

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateWithBuilds]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        next_token=next_token,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
) -> Optional[Union[Error, TemplateWithBuilds]]:
    """List all builds for a template

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateWithBuilds]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            client=client,
            next_token=next_token,
            limit=limit,
        )
    ).parsed
