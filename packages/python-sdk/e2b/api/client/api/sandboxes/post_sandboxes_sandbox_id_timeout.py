from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.post_sandboxes_sandbox_id_timeout_body import (
    PostSandboxesSandboxIDTimeoutBody,
)
from ...types import UNSET, Response, Unset


def _get_kwargs(
    sandbox_id: str,
    *,
    body: PostSandboxesSandboxIDTimeoutBody | Unset = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/sandboxes/{sandbox_id}/timeout".format(
            sandbox_id=quote(str(sandbox_id), safe=""),
        ),
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Any | Error | None:
    if response.status_code == 204:
        response_204 = cast(Any, None)
        return response_204

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
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Any | Error]:
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
    body: PostSandboxesSandboxIDTimeoutBody | Unset = UNSET,
) -> Response[Any | Error]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Error]
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
    body: PostSandboxesSandboxIDTimeoutBody | Unset = UNSET,
) -> Any | Error | None:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Error
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
    body: PostSandboxesSandboxIDTimeoutBody | Unset = UNSET,
) -> Response[Any | Error]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Error]
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
    body: PostSandboxesSandboxIDTimeoutBody | Unset = UNSET,
) -> Any | Error | None:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Error
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            body=body,
        )
    ).parsed
