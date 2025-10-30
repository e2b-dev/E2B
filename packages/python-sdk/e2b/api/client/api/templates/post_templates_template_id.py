from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_build_request import TemplateBuildRequest
from ...models.template_legacy import TemplateLegacy
from ...types import Response


def _get_kwargs(
    template_id: str,
    *,
    body: TemplateBuildRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/templates/{template_id}",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateLegacy]]:
    if response.status_code == 202:
        response_202 = TemplateLegacy.from_dict(response.json())

        return response_202
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, TemplateLegacy]]:
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
    body: TemplateBuildRequest,
) -> Response[Union[Error, TemplateLegacy]]:
    """Rebuild an template

    Args:
        template_id (str):
        body (TemplateBuildRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateLegacy]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildRequest,
) -> Optional[Union[Error, TemplateLegacy]]:
    """Rebuild an template

    Args:
        template_id (str):
        body (TemplateBuildRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateLegacy]
    """

    return sync_detailed(
        template_id=template_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildRequest,
) -> Response[Union[Error, TemplateLegacy]]:
    """Rebuild an template

    Args:
        template_id (str):
        body (TemplateBuildRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateLegacy]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildRequest,
) -> Optional[Union[Error, TemplateLegacy]]:
    """Rebuild an template

    Args:
        template_id (str):
        body (TemplateBuildRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateLegacy]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            client=client,
            body=body,
        )
    ).parsed
