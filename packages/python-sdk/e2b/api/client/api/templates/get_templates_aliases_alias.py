from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_alias_response import TemplateAliasResponse
from ...types import Response


def _get_kwargs(
    alias: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/aliases/{alias}",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateAliasResponse]]:
    if response.status_code == 200:
        response_200 = TemplateAliasResponse.from_dict(response.json())

        return response_200
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
    if response.status_code == 403:
        response_403 = Error.from_dict(response.json())

        return response_403
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
) -> Response[Union[Error, TemplateAliasResponse]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    alias: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, TemplateAliasResponse]]:
    """Check if template with given alias exists

    Args:
        alias (str): Template alias

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateAliasResponse]]
    """

    kwargs = _get_kwargs(
        alias=alias,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    alias: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, TemplateAliasResponse]]:
    """Check if template with given alias exists

    Args:
        alias (str): Template alias

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateAliasResponse]
    """

    return sync_detailed(
        alias=alias,
        client=client,
    ).parsed


async def asyncio_detailed(
    alias: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, TemplateAliasResponse]]:
    """Check if template with given alias exists

    Args:
        alias (str): Template alias

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateAliasResponse]]
    """

    kwargs = _get_kwargs(
        alias=alias,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    alias: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, TemplateAliasResponse]]:
    """Check if template with given alias exists

    Args:
        alias (str): Template alias

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateAliasResponse]
    """

    return (
        await asyncio_detailed(
            alias=alias,
            client=client,
        )
    ).parsed
