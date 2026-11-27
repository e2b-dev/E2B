from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sandbox_paused_retention_request import SandboxPausedRetentionRequest
from ...types import Response


def _get_kwargs(
    sandbox_id: str,
    *,
    body: SandboxPausedRetentionRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": f"/sandboxes/{sandbox_id}/paused-retention",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
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
    if response.status_code == 409:
        response_409 = Error.from_dict(response.json())

        return response_409
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
) -> Response[Union[Any, Error]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    body: SandboxPausedRetentionRequest,
) -> Response[Union[Any, Error]]:
    """Set the paused sandbox retention

     Replace the sandbox's paused retention (pausedRetentionSeconds); null removes it. For a paused
    sandbox the clock restarts: expiresAt becomes the time of the request plus the new retention, or
    null when the retention is removed. A running sandbox keeps the new retention for when its current
    run ends.

    Args:
        sandbox_id (str):
        body (SandboxPausedRetentionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    body: SandboxPausedRetentionRequest,
) -> Optional[Union[Any, Error]]:
    """Set the paused sandbox retention

     Replace the sandbox's paused retention (pausedRetentionSeconds); null removes it. For a paused
    sandbox the clock restarts: expiresAt becomes the time of the request plus the new retention, or
    null when the retention is removed. A running sandbox keeps the new retention for when its current
    run ends.

    Args:
        sandbox_id (str):
        body (SandboxPausedRetentionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    body: SandboxPausedRetentionRequest,
) -> Response[Union[Any, Error]]:
    """Set the paused sandbox retention

     Replace the sandbox's paused retention (pausedRetentionSeconds); null removes it. For a paused
    sandbox the clock restarts: expiresAt becomes the time of the request plus the new retention, or
    null when the retention is removed. A running sandbox keeps the new retention for when its current
    run ends.

    Args:
        sandbox_id (str):
        body (SandboxPausedRetentionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    body: SandboxPausedRetentionRequest,
) -> Optional[Union[Any, Error]]:
    """Set the paused sandbox retention

     Replace the sandbox's paused retention (pausedRetentionSeconds); null removes it. For a paused
    sandbox the clock restarts: expiresAt becomes the time of the request plus the new retention, or
    null when the retention is removed. A running sandbox keeps the new retention for when its current
    run ends.

    Args:
        sandbox_id (str):
        body (SandboxPausedRetentionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            body=body,
        )
    ).parsed
