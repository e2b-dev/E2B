from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_build_file_upload import TemplateBuildFileUpload
from ...types import Response


def _get_kwargs(
    template_id: str,
    hash_: str,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/templates/{template_id}/files/{hash_}",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, TemplateBuildFileUpload]]:
    if response.status_code == 201:
        response_201 = TemplateBuildFileUpload.from_dict(response.json())

        return response_201
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
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
) -> Response[Union[Error, TemplateBuildFileUpload]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    template_id: str,
    hash_: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, TemplateBuildFileUpload]]:
    """Get an upload link for a tar file containing build layer files

    Args:
        template_id (str):
        hash_ (str): Hash of the files

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildFileUpload]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        hash_=hash_,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    hash_: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, TemplateBuildFileUpload]]:
    """Get an upload link for a tar file containing build layer files

    Args:
        template_id (str):
        hash_ (str): Hash of the files

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildFileUpload]
    """

    return sync_detailed(
        template_id=template_id,
        hash_=hash_,
        client=client,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    hash_: str,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Error, TemplateBuildFileUpload]]:
    """Get an upload link for a tar file containing build layer files

    Args:
        template_id (str):
        hash_ (str): Hash of the files

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, TemplateBuildFileUpload]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        hash_=hash_,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    hash_: str,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Error, TemplateBuildFileUpload]]:
    """Get an upload link for a tar file containing build layer files

    Args:
        template_id (str):
        hash_ (str): Hash of the files

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, TemplateBuildFileUpload]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            hash_=hash_,
            client=client,
        )
    ).parsed
