from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.log_level import LogLevel
from ...models.template_build_info import TemplateBuildInfo
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    build_id: str,
    *,
    logs_offset: int | Unset = 0,
    limit: int | Unset = 100,
    level: LogLevel | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["logsOffset"] = logs_offset

    params["limit"] = limit

    json_level: str | Unset = UNSET
    if not isinstance(level, Unset):
        json_level = level.value

    params["level"] = json_level

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/templates/{template_id}/builds/{build_id}/status".format(
            template_id=quote(str(template_id), safe=""),
            build_id=quote(str(build_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | TemplateBuildInfo | None:
    if response.status_code == 200:
        response_200 = TemplateBuildInfo.from_dict(response.json())

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
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | TemplateBuildInfo]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: int | Unset = 0,
    limit: int | Unset = 100,
    level: LogLevel | Unset = UNSET,
) -> Response[Error | TemplateBuildInfo]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        level (LogLevel | Unset): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | TemplateBuildInfo]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        logs_offset=logs_offset,
        limit=limit,
        level=level,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: int | Unset = 0,
    limit: int | Unset = 100,
    level: LogLevel | Unset = UNSET,
) -> Error | TemplateBuildInfo | None:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        level (LogLevel | Unset): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | TemplateBuildInfo
    """

    return sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        logs_offset=logs_offset,
        limit=limit,
        level=level,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: int | Unset = 0,
    limit: int | Unset = 100,
    level: LogLevel | Unset = UNSET,
) -> Response[Error | TemplateBuildInfo]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        level (LogLevel | Unset): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | TemplateBuildInfo]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        logs_offset=logs_offset,
        limit=limit,
        level=level,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: int | Unset = 0,
    limit: int | Unset = 100,
    level: LogLevel | Unset = UNSET,
) -> Error | TemplateBuildInfo | None:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        level (LogLevel | Unset): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | TemplateBuildInfo
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            build_id=build_id,
            client=client,
            logs_offset=logs_offset,
            limit=limit,
            level=level,
        )
    ).parsed
