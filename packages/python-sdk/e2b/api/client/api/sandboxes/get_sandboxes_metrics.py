from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sandboxes_with_metrics import SandboxesWithMetrics
from ...types import UNSET, Response


def _get_kwargs(
    *,
    sandbox_ids: list[str],
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    json_sandbox_ids = sandbox_ids

    params["sandbox_ids"] = ",".join(str(item) for item in json_sandbox_ids)

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sandboxes/metrics",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, SandboxesWithMetrics]]:
    if response.status_code == 200:
        response_200 = SandboxesWithMetrics.from_dict(response.json())

        return response_200
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
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
) -> Response[Union[Error, SandboxesWithMetrics]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    sandbox_ids: list[str],
) -> Response[Union[Error, SandboxesWithMetrics]]:
    """List metrics for given sandboxes

    Args:
        sandbox_ids (list[str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SandboxesWithMetrics]]
    """

    kwargs = _get_kwargs(
        sandbox_ids=sandbox_ids,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    sandbox_ids: list[str],
) -> Optional[Union[Error, SandboxesWithMetrics]]:
    """List metrics for given sandboxes

    Args:
        sandbox_ids (list[str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SandboxesWithMetrics]
    """

    return sync_detailed(
        client=client,
        sandbox_ids=sandbox_ids,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    sandbox_ids: list[str],
) -> Response[Union[Error, SandboxesWithMetrics]]:
    """List metrics for given sandboxes

    Args:
        sandbox_ids (list[str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SandboxesWithMetrics]]
    """

    kwargs = _get_kwargs(
        sandbox_ids=sandbox_ids,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    sandbox_ids: list[str],
) -> Optional[Union[Error, SandboxesWithMetrics]]:
    """List metrics for given sandboxes

    Args:
        sandbox_ids (list[str]):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SandboxesWithMetrics]
    """

    return (
        await asyncio_detailed(
            client=client,
            sandbox_ids=sandbox_ids,
        )
    ).parsed
