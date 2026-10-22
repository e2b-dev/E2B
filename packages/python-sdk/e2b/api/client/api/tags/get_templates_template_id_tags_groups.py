from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.get_templates_template_id_tags_groups_sort import (
    GetTemplatesTemplateIDTagsGroupsSort,
)
from ...models.template_tag_groups_response import TemplateTagGroupsResponse
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    *,
    assignment_limit: Union[Unset, int] = 6,
    tags_limit: Union[Unset, int] = 25,
    tags_cursor: Union[Unset, str] = UNSET,
    search: Union[Unset, str] = UNSET,
    sort: Union[
        Unset, GetTemplatesTemplateIDTagsGroupsSort
    ] = GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["assignmentLimit"] = assignment_limit

    params["tagsLimit"] = tags_limit

    params["tagsCursor"] = tags_cursor

    params["search"] = search

    json_sort: Union[Unset, str] = UNSET
    if not isinstance(sort, Unset):
        json_sort = sort.value

    params["sort"] = json_sort

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/tags/groups",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateTagGroupsResponse]]:
    if response.status_code == 200:
        response_200 = TemplateTagGroupsResponse.from_dict(response.json())

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
) -> Response[Union[Error, TemplateTagGroupsResponse]]:
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
    assignment_limit: Union[Unset, int] = 6,
    tags_limit: Union[Unset, int] = 25,
    tags_cursor: Union[Unset, str] = UNSET,
    search: Union[Unset, str] = UNSET,
    sort: Union[
        Unset, GetTemplatesTemplateIDTagsGroupsSort
    ] = GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC,
) -> Response[Union[Error, TemplateTagGroupsResponse]]:
    """List template tag groups

     Lists the template's tags that have at least one ready build, each with its most recent ready
    assignments, paginated over tags with a keyset cursor. Returns 404 when the template does not exist
    or belongs to another team.

    Args:
        template_id (str):
        assignment_limit (Union[Unset, int]):  Default: 6.
        tags_limit (Union[Unset, int]):  Default: 25.
        tags_cursor (Union[Unset, str]):
        search (Union[Unset, str]):
        sort (Union[Unset, GetTemplatesTemplateIDTagsGroupsSort]):  Default:
            GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagGroupsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        assignment_limit=assignment_limit,
        tags_limit=tags_limit,
        tags_cursor=tags_cursor,
        search=search,
        sort=sort,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    *,
    client: AuthenticatedClient,
    assignment_limit: Union[Unset, int] = 6,
    tags_limit: Union[Unset, int] = 25,
    tags_cursor: Union[Unset, str] = UNSET,
    search: Union[Unset, str] = UNSET,
    sort: Union[
        Unset, GetTemplatesTemplateIDTagsGroupsSort
    ] = GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC,
) -> Optional[Union[Error, TemplateTagGroupsResponse]]:
    """List template tag groups

     Lists the template's tags that have at least one ready build, each with its most recent ready
    assignments, paginated over tags with a keyset cursor. Returns 404 when the template does not exist
    or belongs to another team.

    Args:
        template_id (str):
        assignment_limit (Union[Unset, int]):  Default: 6.
        tags_limit (Union[Unset, int]):  Default: 25.
        tags_cursor (Union[Unset, str]):
        search (Union[Unset, str]):
        sort (Union[Unset, GetTemplatesTemplateIDTagsGroupsSort]):  Default:
            GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagGroupsResponse]
    """

    return sync_detailed(
        template_id=template_id,
        client=client,
        assignment_limit=assignment_limit,
        tags_limit=tags_limit,
        tags_cursor=tags_cursor,
        search=search,
        sort=sort,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    assignment_limit: Union[Unset, int] = 6,
    tags_limit: Union[Unset, int] = 25,
    tags_cursor: Union[Unset, str] = UNSET,
    search: Union[Unset, str] = UNSET,
    sort: Union[
        Unset, GetTemplatesTemplateIDTagsGroupsSort
    ] = GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC,
) -> Response[Union[Error, TemplateTagGroupsResponse]]:
    """List template tag groups

     Lists the template's tags that have at least one ready build, each with its most recent ready
    assignments, paginated over tags with a keyset cursor. Returns 404 when the template does not exist
    or belongs to another team.

    Args:
        template_id (str):
        assignment_limit (Union[Unset, int]):  Default: 6.
        tags_limit (Union[Unset, int]):  Default: 25.
        tags_cursor (Union[Unset, str]):
        search (Union[Unset, str]):
        sort (Union[Unset, GetTemplatesTemplateIDTagsGroupsSort]):  Default:
            GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagGroupsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        assignment_limit=assignment_limit,
        tags_limit=tags_limit,
        tags_cursor=tags_cursor,
        search=search,
        sort=sort,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    *,
    client: AuthenticatedClient,
    assignment_limit: Union[Unset, int] = 6,
    tags_limit: Union[Unset, int] = 25,
    tags_cursor: Union[Unset, str] = UNSET,
    search: Union[Unset, str] = UNSET,
    sort: Union[
        Unset, GetTemplatesTemplateIDTagsGroupsSort
    ] = GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC,
) -> Optional[Union[Error, TemplateTagGroupsResponse]]:
    """List template tag groups

     Lists the template's tags that have at least one ready build, each with its most recent ready
    assignments, paginated over tags with a keyset cursor. Returns 404 when the template does not exist
    or belongs to another team.

    Args:
        template_id (str):
        assignment_limit (Union[Unset, int]):  Default: 6.
        tags_limit (Union[Unset, int]):  Default: 25.
        tags_cursor (Union[Unset, str]):
        search (Union[Unset, str]):
        sort (Union[Unset, GetTemplatesTemplateIDTagsGroupsSort]):  Default:
            GetTemplatesTemplateIDTagsGroupsSort.LATEST_DESC.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagGroupsResponse]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            client=client,
            assignment_limit=assignment_limit,
            tags_limit=tags_limit,
            tags_cursor=tags_cursor,
            search=search,
            sort=sort,
        )
    ).parsed
