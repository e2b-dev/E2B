from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.new_sandbox_v2 import NewSandboxV2
from ...models.sandbox import Sandbox
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: NewSandboxV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/v2/sandboxes",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, Sandbox]]:
    if response.status_code == 201:
        response_201 = Sandbox.from_dict(response.json())

        return response_201
    if response.status_code == 400:
        response_400 = Error.from_dict(response.json())

        return response_400
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 403:
        response_403 = Error.from_dict(response.json())

        return response_403
    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404
    if response.status_code == 409:
        response_409 = Error.from_dict(response.json())

        return response_409
    if response.status_code == 422:
        response_422 = Error.from_dict(response.json())

        return response_422
    if response.status_code == 429:
        response_429 = Error.from_dict(response.json())

        return response_429
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if response.status_code == 503:
        response_503 = Error.from_dict(response.json())

        return response_503
    if response.status_code == 504:
        response_504 = Error.from_dict(response.json())

        return response_504
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, Sandbox]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: NewSandboxV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Response[Union[Error, Sandbox]]:
    """Create sandbox (v2)

     Create a sandbox from the template. All system communication with the sandbox is secured.

    Args:
        idempotency_key (Union[Unset, str]):
        body (NewSandboxV2): Sandbox creation request. All system communication with the sandbox
            is always secured; the template's envd version must support secured access.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, Sandbox]]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient,
    body: NewSandboxV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Optional[Union[Error, Sandbox]]:
    """Create sandbox (v2)

     Create a sandbox from the template. All system communication with the sandbox is secured.

    Args:
        idempotency_key (Union[Unset, str]):
        body (NewSandboxV2): Sandbox creation request. All system communication with the sandbox
            is always secured; the template's envd version must support secured access.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, Sandbox]
    """

    return sync_detailed(
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: NewSandboxV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Response[Union[Error, Sandbox]]:
    """Create sandbox (v2)

     Create a sandbox from the template. All system communication with the sandbox is secured.

    Args:
        idempotency_key (Union[Unset, str]):
        body (NewSandboxV2): Sandbox creation request. All system communication with the sandbox
            is always secured; the template's envd version must support secured access.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, Sandbox]]
    """

    kwargs = _get_kwargs(
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient,
    body: NewSandboxV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Optional[Union[Error, Sandbox]]:
    """Create sandbox (v2)

     Create a sandbox from the template. All system communication with the sandbox is secured.

    Args:
        idempotency_key (Union[Unset, str]):
        body (NewSandboxV2): Sandbox creation request. All system communication with the sandbox
            is always secured; the template's envd version must support secured access.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, Sandbox]
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
