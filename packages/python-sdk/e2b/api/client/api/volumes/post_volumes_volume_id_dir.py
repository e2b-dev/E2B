from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.volume_entry_stat import VolumeEntryStat
from ...types import UNSET, Response, Unset


def _get_kwargs(
    volume_id: str,
    *,
    path: str,
    uid: Union[Unset, int] = UNSET,
    gid: Union[Unset, int] = UNSET,
    mode: Union[Unset, int] = UNSET,
    create_parents: Union[Unset, bool] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["path"] = path

    params["uid"] = uid

    params["gid"] = gid

    params["mode"] = mode

    params["createParents"] = create_parents

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/volumes/{volume_id}/dir",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, Error, VolumeEntryStat]]:
    if response.status_code == 201:
        response_201 = VolumeEntryStat.from_dict(response.json())

        return response_201
    if response.status_code == 404:
        response_404 = cast(Any, None)
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
) -> Response[Union[Any, Error, VolumeEntryStat]]:
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
    path: str,
    uid: Union[Unset, int] = UNSET,
    gid: Union[Unset, int] = UNSET,
    mode: Union[Unset, int] = UNSET,
    create_parents: Union[Unset, bool] = UNSET,
) -> Response[Union[Any, Error, VolumeEntryStat]]:
    """Create a directory

    Args:
        volume_id (str):
        path (str):
        uid (Union[Unset, int]):
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
        create_parents (Union[Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error, VolumeEntryStat]]
    """

    kwargs = _get_kwargs(
        volume_id=volume_id,
        path=path,
        uid=uid,
        gid=gid,
        mode=mode,
        create_parents=create_parents,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    path: str,
    uid: Union[Unset, int] = UNSET,
    gid: Union[Unset, int] = UNSET,
    mode: Union[Unset, int] = UNSET,
    create_parents: Union[Unset, bool] = UNSET,
) -> Optional[Union[Any, Error, VolumeEntryStat]]:
    """Create a directory

    Args:
        volume_id (str):
        path (str):
        uid (Union[Unset, int]):
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
        create_parents (Union[Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error, VolumeEntryStat]
    """

    return sync_detailed(
        volume_id=volume_id,
        client=client,
        path=path,
        uid=uid,
        gid=gid,
        mode=mode,
        create_parents=create_parents,
    ).parsed


async def asyncio_detailed(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    path: str,
    uid: Union[Unset, int] = UNSET,
    gid: Union[Unset, int] = UNSET,
    mode: Union[Unset, int] = UNSET,
    create_parents: Union[Unset, bool] = UNSET,
) -> Response[Union[Any, Error, VolumeEntryStat]]:
    """Create a directory

    Args:
        volume_id (str):
        path (str):
        uid (Union[Unset, int]):
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
        create_parents (Union[Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error, VolumeEntryStat]]
    """

    kwargs = _get_kwargs(
        volume_id=volume_id,
        path=path,
        uid=uid,
        gid=gid,
        mode=mode,
        create_parents=create_parents,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    volume_id: str,
    *,
    client: AuthenticatedClient,
    path: str,
    uid: Union[Unset, int] = UNSET,
    gid: Union[Unset, int] = UNSET,
    mode: Union[Unset, int] = UNSET,
    create_parents: Union[Unset, bool] = UNSET,
) -> Optional[Union[Any, Error, VolumeEntryStat]]:
    """Create a directory

    Args:
        volume_id (str):
        path (str):
        uid (Union[Unset, int]):
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
        create_parents (Union[Unset, bool]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error, VolumeEntryStat]
    """

    return (
        await asyncio_detailed(
            volume_id=volume_id,
            client=client,
            path=path,
            uid=uid,
            gid=gid,
            mode=mode,
            create_parents=create_parents,
        )
    ).parsed
