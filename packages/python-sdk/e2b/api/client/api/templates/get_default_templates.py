from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template import Template
from ...types import Response


def _get_kwargs() -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/default-templates",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["Template"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = Template.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 429:
        response_429 = Error.from_dict(response.json())

        return response_429
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, list["Template"]]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, list["Template"]]]:
    """List default templates

     Lists the platform's default templates, ordered by template ID. Deleted templates are left out.
    Templates that are not public are listed only to their own team and to admin callers. The build,
    resources and envd version are those of the newest ready build tagged `default`, the one a sandbox
    started from the template runs, and are zero or empty when there is none; `buildStatus` describes
    the newest build tagged `default` in any state. Usage fields (`spawnCount`, `buildCount`,
    `lastSpawnedAt`, `createdBy`) are reported only for the caller's own templates and to admin callers.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['Template']]]
    """

    kwargs = _get_kwargs()

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, list["Template"]]]:
    """List default templates

     Lists the platform's default templates, ordered by template ID. Deleted templates are left out.
    Templates that are not public are listed only to their own team and to admin callers. The build,
    resources and envd version are those of the newest ready build tagged `default`, the one a sandbox
    started from the template runs, and are zero or empty when there is none; `buildStatus` describes
    the newest build tagged `default` in any state. Usage fields (`spawnCount`, `buildCount`,
    `lastSpawnedAt`, `createdBy`) are reported only for the caller's own templates and to admin callers.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['Template']]
    """

    return sync_detailed(
        client=client,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, list["Template"]]]:
    """List default templates

     Lists the platform's default templates, ordered by template ID. Deleted templates are left out.
    Templates that are not public are listed only to their own team and to admin callers. The build,
    resources and envd version are those of the newest ready build tagged `default`, the one a sandbox
    started from the template runs, and are zero or empty when there is none; `buildStatus` describes
    the newest build tagged `default` in any state. Usage fields (`spawnCount`, `buildCount`,
    `lastSpawnedAt`, `createdBy`) are reported only for the caller's own templates and to admin callers.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['Template']]]
    """

    kwargs = _get_kwargs()

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, list["Template"]]]:
    """List default templates

     Lists the platform's default templates, ordered by template ID. Deleted templates are left out.
    Templates that are not public are listed only to their own team and to admin callers. The build,
    resources and envd version are those of the newest ready build tagged `default`, the one a sandbox
    started from the template runs, and are zero or empty when there is none; `buildStatus` describes
    the newest build tagged `default` in any state. Usage fields (`spawnCount`, `buildCount`,
    `lastSpawnedAt`, `createdBy`) are reported only for the caller's own templates and to admin callers.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['Template']]
    """

    return (
        await asyncio_detailed(
            client=client,
        )
    ).parsed
