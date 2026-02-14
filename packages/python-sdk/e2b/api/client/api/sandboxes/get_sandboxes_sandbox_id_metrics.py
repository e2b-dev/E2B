from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sandbox_metric import SandboxMetric
from ...types import UNSET, Response, Unset


def _get_kwargs(
    sandbox_id: str,
    *,
    start: Union[Unset, int] = UNSET,
    end: Union[Unset, int] = UNSET,
) -> dict[str, Any]:
    params: dict[str, Any] = {}

    params["start"] = start

    params["end"] = end

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": f"/sandboxes/{sandbox_id}/metrics",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["SandboxMetric"]]]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in _response_200:
            response_200_item = SandboxMetric.from_dict(response_200_item_data)

            response_200.append(response_200_item)

        return response_200
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
) -> Response[Union[Error, list["SandboxMetric"]]]:
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
    start: Union[Unset, int] = UNSET,
    end: Union[Unset, int] = UNSET,
) -> Response[Union[Error, list["SandboxMetric"]]]:
    """Get sandbox metrics

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        end (Union[Unset, int]): Unix timestamp for the end of the interval, in seconds, for which
            the metrics

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxMetric']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        start=start,
        end=end,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    end: Union[Unset, int] = UNSET,
) -> Optional[Union[Error, list["SandboxMetric"]]]:
    """Get sandbox metrics

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        end (Union[Unset, int]): Unix timestamp for the end of the interval, in seconds, for which
            the metrics

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxMetric']]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        client=client,
        start=start,
        end=end,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    end: Union[Unset, int] = UNSET,
) -> Response[Union[Error, list["SandboxMetric"]]]:
    """Get sandbox metrics

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        end (Union[Unset, int]): Unix timestamp for the end of the interval, in seconds, for which
            the metrics

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxMetric']]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        start=start,
        end=end,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    *,
    client: AuthenticatedClient,
    start: Union[Unset, int] = UNSET,
    end: Union[Unset, int] = UNSET,
) -> Optional[Union[Error, list["SandboxMetric"]]]:
    """Get sandbox metrics

    Args:
        sandbox_id (str):
        start (Union[Unset, int]):
        end (Union[Unset, int]): Unix timestamp for the end of the interval, in seconds, for which
            the metrics

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxMetric']]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            start=start,
            end=end,
        )
    ).parsed
