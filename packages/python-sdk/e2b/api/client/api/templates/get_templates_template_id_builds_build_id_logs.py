from http import HTTPStatus
from typing import Any
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.log_level import LogLevel
from ...models.logs_direction import LogsDirection
from ...models.logs_source import LogsSource
from ...models.template_build_logs_response import TemplateBuildLogsResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    build_id: str,
    *,
    cursor: int | Unset = UNSET,
    limit: int | Unset = 100,
    direction: LogsDirection | Unset = UNSET,
    level: LogLevel | Unset = UNSET,
    source: LogsSource | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_direction: str | Unset = UNSET
    if not isinstance(direction, Unset):
        json_direction = direction.value

    params["direction"] = json_direction

    json_level: str | Unset = UNSET
    if not isinstance(level, Unset):
        json_level = level.value

    params["level"] = json_level

    json_source: str | Unset = UNSET
    if not isinstance(source, Unset):
        json_source = source.value

    params["source"] = json_source

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/templates/{template_id}/builds/{build_id}/logs".format(
            template_id=quote(str(template_id), safe=""),
            build_id=quote(str(build_id), safe=""),
        ),
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | TemplateBuildLogsResponse | None:
    if response.status_code == 200:
        response_200 = TemplateBuildLogsResponse.from_dict(response.json())

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
) -> Response[Error | TemplateBuildLogsResponse]:
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
    cursor: int | Unset = UNSET,
    limit: int | Unset = 100,
    direction: LogsDirection | Unset = UNSET,
    level: LogLevel | Unset = UNSET,
    source: LogsSource | Unset = UNSET,
) -> Response[Error | TemplateBuildLogsResponse]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (int | Unset):
        limit (int | Unset):  Default: 100.
        direction (LogsDirection | Unset): Direction of the logs that should be returned
        level (LogLevel | Unset): State of the sandbox
        source (LogsSource | Unset): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | TemplateBuildLogsResponse]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        cursor=cursor,
        limit=limit,
        direction=direction,
        level=level,
        source=source,
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
    cursor: int | Unset = UNSET,
    limit: int | Unset = 100,
    direction: LogsDirection | Unset = UNSET,
    level: LogLevel | Unset = UNSET,
    source: LogsSource | Unset = UNSET,
) -> Error | TemplateBuildLogsResponse | None:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (int | Unset):
        limit (int | Unset):  Default: 100.
        direction (LogsDirection | Unset): Direction of the logs that should be returned
        level (LogLevel | Unset): State of the sandbox
        source (LogsSource | Unset): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | TemplateBuildLogsResponse
    """

    return sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        cursor=cursor,
        limit=limit,
        direction=direction,
        level=level,
        source=source,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    cursor: int | Unset = UNSET,
    limit: int | Unset = 100,
    direction: LogsDirection | Unset = UNSET,
    level: LogLevel | Unset = UNSET,
    source: LogsSource | Unset = UNSET,
) -> Response[Error | TemplateBuildLogsResponse]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (int | Unset):
        limit (int | Unset):  Default: 100.
        direction (LogsDirection | Unset): Direction of the logs that should be returned
        level (LogLevel | Unset): State of the sandbox
        source (LogsSource | Unset): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | TemplateBuildLogsResponse]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        cursor=cursor,
        limit=limit,
        direction=direction,
        level=level,
        source=source,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    cursor: int | Unset = UNSET,
    limit: int | Unset = 100,
    direction: LogsDirection | Unset = UNSET,
    level: LogLevel | Unset = UNSET,
    source: LogsSource | Unset = UNSET,
) -> Error | TemplateBuildLogsResponse | None:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (int | Unset):
        limit (int | Unset):  Default: 100.
        direction (LogsDirection | Unset): Direction of the logs that should be returned
        level (LogLevel | Unset): State of the sandbox
        source (LogsSource | Unset): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | TemplateBuildLogsResponse
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            build_id=build_id,
            client=client,
            cursor=cursor,
            limit=limit,
            direction=direction,
            level=level,
            source=source,
        )
    ).parsed
