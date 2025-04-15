from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.post_sandboxes_sandbox_id_timeout_body import (
    PostSandboxesSandboxIDTimeoutBody,
)
from ...types import Response


def _get_kwargs(
    sandbox_id: str,
    *,
    body: PostSandboxesSandboxIDTimeoutBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/sandboxes/{sandbox_id}/timeout",
    }

    _body = body.to_dict()

    _kwargs["json"] = _body
    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, Error]]:
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
    body: PostSandboxesSandboxIDTimeoutBody,
) -> Response[Union[Any, Error]]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody):

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
    body: PostSandboxesSandboxIDTimeoutBody,
) -> Optional[Union[Any, Error]]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody):

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
    body: PostSandboxesSandboxIDTimeoutBody,
) -> Response[Union[Any, Error]]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody):

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
    body: PostSandboxesSandboxIDTimeoutBody,
) -> Optional[Union[Any, Error]]:
    """Set the timeout for the sandbox. The sandbox will expire x seconds from the time of the request.
    Calling this method multiple times overwrites the TTL, each time using the current timestamp as the
    starting point to measure the timeout duration.

    Args:
        sandbox_id (str):
        body (PostSandboxesSandboxIDTimeoutBody):

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
