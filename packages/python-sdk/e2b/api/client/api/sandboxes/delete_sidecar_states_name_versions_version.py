from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...types import Response


def _get_kwargs(
    name: str,
    version: int,
) -> dict[str, Any]:
    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": f"/sidecar-states/{name}/versions/{version}",
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, Error]]:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204
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
) -> Response[Union[Any, Error]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    name: str,
    version: int,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Any, Error]]:
    """Delete sidecar state version

     Delete one version of a saved sidecar state. Deleting the last version deletes the name. A running
    sandbox that attached the version holds its own copy and is unaffected; a creation still restoring
    the version fails instead. A 400 response carries sidecar_state_flag_off; a 404 response carries
    sidecar_state_unknown or sidecar_state_version_unknown.

    Args:
        name (str):
        version (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        name=name,
        version=version,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    name: str,
    version: int,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Any, Error]]:
    """Delete sidecar state version

     Delete one version of a saved sidecar state. Deleting the last version deletes the name. A running
    sandbox that attached the version holds its own copy and is unaffected; a creation still restoring
    the version fails instead. A 400 response carries sidecar_state_flag_off; a 404 response carries
    sidecar_state_unknown or sidecar_state_version_unknown.

    Args:
        name (str):
        version (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return sync_detailed(
        name=name,
        version=version,
        client=client,
    ).parsed


async def asyncio_detailed(
    name: str,
    version: int,
    *,
    client: AuthenticatedClient,
) -> Response[Union[Any, Error]]:
    """Delete sidecar state version

     Delete one version of a saved sidecar state. Deleting the last version deletes the name. A running
    sandbox that attached the version holds its own copy and is unaffected; a creation still restoring
    the version fails instead. A 400 response carries sidecar_state_flag_off; a 404 response carries
    sidecar_state_unknown or sidecar_state_version_unknown.

    Args:
        name (str):
        version (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        name=name,
        version=version,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    name: str,
    version: int,
    *,
    client: AuthenticatedClient,
) -> Optional[Union[Any, Error]]:
    """Delete sidecar state version

     Delete one version of a saved sidecar state. Deleting the last version deletes the name. A running
    sandbox that attached the version holds its own copy and is unaffected; a creation still restoring
    the version fails instead. A 400 response carries sidecar_state_flag_off; a 404 response carries
    sidecar_state_unknown or sidecar_state_version_unknown.

    Args:
        name (str):
        version (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return (
        await asyncio_detailed(
            name=name,
            version=version,
            client=client,
        )
    ).parsed
