from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sandbox_fork_request import SandboxForkRequest
from ...models.sandbox_fork_result import SandboxForkResult
from ...types import Response


def _get_kwargs(
    sandbox_id: str,
    *,
    body: SandboxForkRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/sandboxes/{sandbox_id}/fork",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, list["SandboxForkResult"]]]:
    if response.status_code == 201:
        response_201 = []
        _response_201 = response.json()
        for response_201_item_data in _response_201:
            response_201_item = SandboxForkResult.from_dict(response_201_item_data)

            response_201.append(response_201_item)

        return response_201
    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401
    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404
    if response.status_code == 409:
        response_409 = Error.from_dict(response.json())

        return response_409
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, list["SandboxForkResult"]]]:
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
    body: SandboxForkRequest,
) -> Response[Union[Error, list["SandboxForkResult"]]]:
    """Fork sandbox

     Fork the sandbox: checkpoint the running sandbox in place (it is briefly paused, snapshotted with
    its full memory state, and resumed on its node, keeping its ID and expiration untouched) and create
    count new sandboxes from that snapshot. Returns one result per requested fork, each carrying either
    the created sandbox or the error that prevented it from starting. A non-201 status means the request
    failed before any fork was attempted.

    Args:
        sandbox_id (str):
        body (SandboxForkRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxForkResult']]]
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
    body: SandboxForkRequest,
) -> Optional[Union[Error, list["SandboxForkResult"]]]:
    """Fork sandbox

     Fork the sandbox: checkpoint the running sandbox in place (it is briefly paused, snapshotted with
    its full memory state, and resumed on its node, keeping its ID and expiration untouched) and create
    count new sandboxes from that snapshot. Returns one result per requested fork, each carrying either
    the created sandbox or the error that prevented it from starting. A non-201 status means the request
    failed before any fork was attempted.

    Args:
        sandbox_id (str):
        body (SandboxForkRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxForkResult']]
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
    body: SandboxForkRequest,
) -> Response[Union[Error, list["SandboxForkResult"]]]:
    """Fork sandbox

     Fork the sandbox: checkpoint the running sandbox in place (it is briefly paused, snapshotted with
    its full memory state, and resumed on its node, keeping its ID and expiration untouched) and create
    count new sandboxes from that snapshot. Returns one result per requested fork, each carrying either
    the created sandbox or the error that prevented it from starting. A non-201 status means the request
    failed before any fork was attempted.

    Args:
        sandbox_id (str):
        body (SandboxForkRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, list['SandboxForkResult']]]
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
    body: SandboxForkRequest,
) -> Optional[Union[Error, list["SandboxForkResult"]]]:
    """Fork sandbox

     Fork the sandbox: checkpoint the running sandbox in place (it is briefly paused, snapshotted with
    its full memory state, and resumed on its node, keeping its ID and expiration untouched) and create
    count new sandboxes from that snapshot. Returns one result per requested fork, each carrying either
    the created sandbox or the error that prevented it from starting. A non-201 status means the request
    failed before any fork was attempted.

    Args:
        sandbox_id (str):
        body (SandboxForkRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, list['SandboxForkResult']]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            client=client,
            body=body,
        )
    ).parsed
