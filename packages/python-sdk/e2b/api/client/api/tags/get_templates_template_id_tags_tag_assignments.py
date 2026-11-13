from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_tag_assignments_response import TemplateTagAssignmentsResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    tag: str,
    *,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 50,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/tags/{tag}/assignments",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateTagAssignmentsResponse]]:
    if response.status_code == 200:
        response_200 = TemplateTagAssignmentsResponse.from_dict(response.json())

        return response_200
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 403:
        response_403 = Error.from_dict(response.json())

        return response_403
    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404
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
) -> Response[Union[Error, TemplateTagAssignmentsResponse]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    template_id: str,
    tag: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 50,
) -> Response[Union[Error, TemplateTagAssignmentsResponse]]:
    """List template tag assignments

     Lists the ready assignments of one tag of the template, newest first, with keyset cursor pagination.
    Returns 404 when the template does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str): Tag name
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagAssignmentsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        tag=tag,
        cursor=cursor,
        limit=limit,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    tag: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 50,
) -> Optional[Union[Error, TemplateTagAssignmentsResponse]]:
    """List template tag assignments

     Lists the ready assignments of one tag of the template, newest first, with keyset cursor pagination.
    Returns 404 when the template does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str): Tag name
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagAssignmentsResponse]
    """

    return sync_detailed(
        template_id=template_id,
        tag=tag,
        client=client,
        cursor=cursor,
        limit=limit,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    tag: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 50,
) -> Response[Union[Error, TemplateTagAssignmentsResponse]]:
    """List template tag assignments

     Lists the ready assignments of one tag of the template, newest first, with keyset cursor pagination.
    Returns 404 when the template does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str): Tag name
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagAssignmentsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        tag=tag,
        cursor=cursor,
        limit=limit,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    tag: str,
    *,
    client: AuthenticatedClient,
    cursor: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 50,
) -> Optional[Union[Error, TemplateTagAssignmentsResponse]]:
    """List template tag assignments

     Lists the ready assignments of one tag of the template, newest first, with keyset cursor pagination.
    Returns 404 when the template does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str): Tag name
        cursor (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagAssignmentsResponse]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            tag=tag,
            client=client,
            cursor=cursor,
            limit=limit,
        )
    ).parsed
