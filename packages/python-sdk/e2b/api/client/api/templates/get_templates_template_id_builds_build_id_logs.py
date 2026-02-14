from http import HTTPStatus
from typing import Any, Optional, Union

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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 100,
    direction: Union[Unset, LogsDirection] = UNSET,
    level: Union[Unset, LogLevel] = UNSET,
    source: Union[Unset, LogsSource] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_direction: Union[Unset, str] = UNSET
    if not isinstance(direction, Unset):
        json_direction = direction.value

    params["direction"] = json_direction

    json_level: Union[Unset, str] = UNSET
    if not isinstance(level, Unset):
        json_level = level.value

    params["level"] = json_level

    json_source: Union[Unset, str] = UNSET
    if not isinstance(source, Unset):
        json_source = source.value

    params["source"] = json_source

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/builds/{build_id}/logs",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateBuildLogsResponse]]:
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
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, TemplateBuildLogsResponse]]:
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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 100,
    direction: Union[Unset, LogsDirection] = UNSET,
    level: Union[Unset, LogLevel] = UNSET,
    source: Union[Unset, LogsSource] = UNSET,
) -> Response[Union[Error, TemplateBuildLogsResponse]]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 100.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned
        level (Union[Unset, LogLevel]): State of the sandbox
        source (Union[Unset, LogsSource]): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildLogsResponse]]
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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 100,
    direction: Union[Unset, LogsDirection] = UNSET,
    level: Union[Unset, LogLevel] = UNSET,
    source: Union[Unset, LogsSource] = UNSET,
) -> Optional[Union[Error, TemplateBuildLogsResponse]]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 100.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned
        level (Union[Unset, LogLevel]): State of the sandbox
        source (Union[Unset, LogsSource]): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildLogsResponse]
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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 100,
    direction: Union[Unset, LogsDirection] = UNSET,
    level: Union[Unset, LogLevel] = UNSET,
    source: Union[Unset, LogsSource] = UNSET,
) -> Response[Union[Error, TemplateBuildLogsResponse]]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 100.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned
        level (Union[Unset, LogLevel]): State of the sandbox
        source (Union[Unset, LogsSource]): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildLogsResponse]]
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
    cursor: Union[Unset, int] = UNSET,
    limit: Union[Unset, int] = 100,
    direction: Union[Unset, LogsDirection] = UNSET,
    level: Union[Unset, LogLevel] = UNSET,
    source: Union[Unset, LogsSource] = UNSET,
) -> Optional[Union[Error, TemplateBuildLogsResponse]]:
    """Get template build logs

    Args:
        template_id (str):
        build_id (str):
        cursor (Union[Unset, int]):
        limit (Union[Unset, int]):  Default: 100.
        direction (Union[Unset, LogsDirection]): Direction of the logs that should be returned
        level (Union[Unset, LogLevel]): State of the sandbox
        source (Union[Unset, LogsSource]): Source of the logs that should be returned

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildLogsResponse]
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
