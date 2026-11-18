from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_build_status import TemplateBuildStatus
from ...models.template_build_with_tags import TemplateBuildWithTags
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    *,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
    statuses: Union[Unset, list[TemplateBuildStatus]] = UNSET,
    tags: Union[Unset, list[str]] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["nextToken"] = next_token

    params["limit"] = limit

    json_statuses: Union[Unset, list[str]] = UNSET
    if not isinstance(statuses, Unset):
        json_statuses = []
        for statuses_item_data in statuses:
            statuses_item = statuses_item_data.value
            json_statuses.append(statuses_item)

    if not isinstance(json_statuses, Unset):
        params["statuses"] = ",".join(str(item) for item in json_statuses)

    json_tags: Union[Unset, list[str]] = UNSET
    if not isinstance(tags, Unset):
        json_tags = tags

    if not isinstance(json_tags, Unset):
        params["tags"] = ",".join(str(item) for item in json_tags)

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/builds",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["TemplateBuildWithTags"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = TemplateBuildWithTags.from_dict(response_200_item_data)

            response_200.append(response_200_item)

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
) -> Response[Union[Error, list["TemplateBuildWithTags"]]]:
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
    statuses: Union[Unset, list[TemplateBuildStatus]] = UNSET,
    tags: Union[Unset, list[str]] = UNSET,
) -> Response[Union[Error, list["TemplateBuildWithTags"]]]:
    """List a template's builds

     List the builds of a template, newest first. The template is given by its ID or name. A template
    named `aliases` is given by its ID or by its name with the team prefix.

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.
        statuses (Union[Unset, list[TemplateBuildStatus]]):
        tags (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['TemplateBuildWithTags']]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        next_token=next_token,
        limit=limit,
        statuses=statuses,
        tags=tags,
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
    statuses: Union[Unset, list[TemplateBuildStatus]] = UNSET,
    tags: Union[Unset, list[str]] = UNSET,
) -> Optional[Union[Error, list["TemplateBuildWithTags"]]]:
    """List a template's builds

     List the builds of a template, newest first. The template is given by its ID or name. A template
    named `aliases` is given by its ID or by its name with the team prefix.

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.
        statuses (Union[Unset, list[TemplateBuildStatus]]):
        tags (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['TemplateBuildWithTags']]
    """

    return sync_detailed(
        template_id=template_id,
        client=client,
        next_token=next_token,
        limit=limit,
        statuses=statuses,
        tags=tags,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
    statuses: Union[Unset, list[TemplateBuildStatus]] = UNSET,
    tags: Union[Unset, list[str]] = UNSET,
) -> Response[Union[Error, list["TemplateBuildWithTags"]]]:
    """List a template's builds

     List the builds of a template, newest first. The template is given by its ID or name. A template
    named `aliases` is given by its ID or by its name with the team prefix.

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.
        statuses (Union[Unset, list[TemplateBuildStatus]]):
        tags (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['TemplateBuildWithTags']]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        next_token=next_token,
        limit=limit,
        statuses=statuses,
        tags=tags,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    *,
    client: AuthenticatedClient,
    next_token: Union[Unset, str] = UNSET,
    limit: Union[Unset, int] = 100,
    statuses: Union[Unset, list[TemplateBuildStatus]] = UNSET,
    tags: Union[Unset, list[str]] = UNSET,
) -> Optional[Union[Error, list["TemplateBuildWithTags"]]]:
    """List a template's builds

     List the builds of a template, newest first. The template is given by its ID or name. A template
    named `aliases` is given by its ID or by its name with the team prefix.

    Args:
        template_id (str):
        next_token (Union[Unset, str]):
        limit (Union[Unset, int]):  Default: 100.
        statuses (Union[Unset, list[TemplateBuildStatus]]):
        tags (Union[Unset, list[str]]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['TemplateBuildWithTags']]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            client=client,
            next_token=next_token,
            limit=limit,
            statuses=statuses,
            tags=tags,
        )
    ).parsed
