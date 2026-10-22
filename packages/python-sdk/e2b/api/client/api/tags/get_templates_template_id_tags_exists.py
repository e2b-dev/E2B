from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_tag_exists_response import TemplateTagExistsResponse
from ...types import UNSET, Response


def _get_kwargs(
    template_id: str,
    *,
    tag: str,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["tag"] = tag

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/tags/exists",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateTagExistsResponse]]:
    if response.status_code == 200:
        response_200 = TemplateTagExistsResponse.from_dict(response.json())

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
) -> Response[Union[Error, TemplateTagExistsResponse]]:
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
    tag: str,
) -> Response[Union[Error, TemplateTagExistsResponse]]:
    """Check template tag

     Checks whether a tag of the template has at least one ready build. Returns 404 when the template
    does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagExistsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        tag=tag,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    *,
    client: AuthenticatedClient,
    tag: str,
) -> Optional[Union[Error, TemplateTagExistsResponse]]:
    """Check template tag

     Checks whether a tag of the template has at least one ready build. Returns 404 when the template
    does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagExistsResponse]
    """

    return sync_detailed(
        template_id=template_id,
        client=client,
        tag=tag,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    tag: str,
) -> Response[Union[Error, TemplateTagExistsResponse]]:
    """Check template tag

     Checks whether a tag of the template has at least one ready build. Returns 404 when the template
    does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateTagExistsResponse]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        tag=tag,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    *,
    client: AuthenticatedClient,
    tag: str,
) -> Optional[Union[Error, TemplateTagExistsResponse]]:
    """Check template tag

     Checks whether a tag of the template has at least one ready build. Returns 404 when the template
    does not exist or belongs to another team.

    Args:
        template_id (str):
        tag (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateTagExistsResponse]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            client=client,
            tag=tag,
        )
    ).parsed
