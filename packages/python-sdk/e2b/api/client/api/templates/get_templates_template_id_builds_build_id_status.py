from http import HTTPStatus
from typing import Any, Optional, Union

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
    logs_offset: Union[Unset, int] = 0,
    level: Union[Unset, LogLevel] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["logsOffset"] = logs_offset

    json_level: Union[Unset, str] = UNSET
    if not isinstance(level, Unset):
        json_level = level.value

    params["level"] = json_level

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/builds/{build_id}/status",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateBuildInfo]]:
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
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, TemplateBuildInfo]]:
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
    logs_offset: Union[Unset, int] = 0,
    level: Union[Unset, LogLevel] = UNSET,
) -> Response[Union[Error, TemplateBuildInfo]]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (Union[Unset, int]):  Default: 0.
        level (Union[Unset, LogLevel]): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildInfo]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        logs_offset=logs_offset,
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
    logs_offset: Union[Unset, int] = 0,
    level: Union[Unset, LogLevel] = UNSET,
) -> Optional[Union[Error, TemplateBuildInfo]]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (Union[Unset, int]):  Default: 0.
        level (Union[Unset, LogLevel]): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildInfo]
    """

    return sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        logs_offset=logs_offset,
        level=level,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: Union[Unset, int] = 0,
    level: Union[Unset, LogLevel] = UNSET,
) -> Response[Union[Error, TemplateBuildInfo]]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (Union[Unset, int]):  Default: 0.
        level (Union[Unset, LogLevel]): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildInfo]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        logs_offset=logs_offset,
        level=level,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    logs_offset: Union[Unset, int] = 0,
    level: Union[Unset, LogLevel] = UNSET,
) -> Optional[Union[Error, TemplateBuildInfo]]:
    """Get template build info

    Args:
        template_id (str):
        build_id (str):
        logs_offset (Union[Unset, int]):  Default: 0.
        level (Union[Unset, LogLevel]): State of the sandbox

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildInfo]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            build_id=build_id,
            client=client,
            logs_offset=logs_offset,
            level=level,
        )
    ).parsed
