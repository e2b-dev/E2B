from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.patch_volumes_volume_id_file_body import PatchVolumesVolumeIDFileBody
from ...models.volume_entry_stat import VolumeEntryStat
from ...types import UNSET, Response


def _get_kwargs(
    volume_id: str,
    *,
    body: PatchVolumesVolumeIDFileBody,
    path: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    params["path"] = path

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": f"/volumes/{volume_id}/file",
        "params": params,
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, VolumeEntryStat]]:
    if response.status_code == 200:
        response_200 = VolumeEntryStat.from_dict(response.json())

        return response_200
    if response.status_code == 400:
        response_400 = cast(Any, None)
        return response_400
    if response.status_code == 404:
        response_404 = cast(Any, None)
        return response_404
    if response.status_code == 500:
        response_500 = cast(Any, None)
        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Any, VolumeEntryStat]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchVolumesVolumeIDFileBody,
    path: str,
) -> Response[Union[Any, VolumeEntryStat]]:
    """Update file metadata

    Args:
        volume_id (str):
        path (str):
        body (PatchVolumesVolumeIDFileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, VolumeEntryStat]]
    """

    kwargs = _get_kwargs(
        volume_id=volume_id,
        body=body,
        path=path,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchVolumesVolumeIDFileBody,
    path: str,
) -> Optional[Union[Any, VolumeEntryStat]]:
    """Update file metadata

    Args:
        volume_id (str):
        path (str):
        body (PatchVolumesVolumeIDFileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, VolumeEntryStat]
    """

    return sync_detailed(
        volume_id=volume_id,
        client=client,
        body=body,
        path=path,
    ).parsed


async def asyncio_detailed(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchVolumesVolumeIDFileBody,
    path: str,
) -> Response[Union[Any, VolumeEntryStat]]:
    """Update file metadata

    Args:
        volume_id (str):
        path (str):
        body (PatchVolumesVolumeIDFileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, VolumeEntryStat]]
    """

    kwargs = _get_kwargs(
        volume_id=volume_id,
        body=body,
        path=path,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    body: PatchVolumesVolumeIDFileBody,
    path: str,
) -> Optional[Union[Any, VolumeEntryStat]]:
    """Update file metadata

    Args:
        volume_id (str):
        path (str):
        body (PatchVolumesVolumeIDFileBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, VolumeEntryStat]
    """

    return (
        await asyncio_detailed(
            volume_id=volume_id,
            client=client,
            body=body,
            path=path,
        )
    ).parsed
