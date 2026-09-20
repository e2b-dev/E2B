from http import HTTPStatus
from typing import Any, Optional, Union

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.sidecar_state_save_request import SidecarStateSaveRequest
from ...models.sidecar_state_version import SidecarStateVersion
from ...types import Response


def _get_kwargs(
    sandbox_id: str,
    entry: str,
    *,
    body: SidecarStateSaveRequest,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/sandboxes/{sandbox_id}/sidecars/{entry}/state",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Error, SidecarStateVersion]]:
    if response.status_code == 201:
        response_201 = SidecarStateVersion.from_dict(response.json())

        return response_201
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
    if response.status_code == 500:
        response_500 = Error.from_dict(response.json())

        return response_500
    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Response[Union[Error, SidecarStateVersion]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    sandbox_id: str,
    entry: str,
    *,
    client: AuthenticatedClient,
    body: SidecarStateSaveRequest,
) -> Response[Union[Error, SidecarStateVersion]]:
    """Save sidecar state

     Save the data disk of one of the sandbox's sidecars as a new version of a named, team-scoped sidecar
    state. The sidecar is quiesced for the copy and keeps serving; the version is recorded only once the
    upload is durable. Rejections carry an error_code: sidecar_state_flag_off,
    sidecar_state_name_invalid, sidecar_state_unsupported (the entry has no data disk),
    sidecar_state_entry_mismatch, sidecar_state_size_mismatch and sidecar_state_limit are 400;
    sidecar_not_running and sidecar_state_busy (a save for this sidecar is already in flight) are 409;
    sidecar_state_failed is 500.

    Args:
        sandbox_id (str):
        entry (str):
        body (SidecarStateSaveRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SidecarStateVersion]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        entry=entry,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    sandbox_id: str,
    entry: str,
    *,
    client: AuthenticatedClient,
    body: SidecarStateSaveRequest,
) -> Optional[Union[Error, SidecarStateVersion]]:
    """Save sidecar state

     Save the data disk of one of the sandbox's sidecars as a new version of a named, team-scoped sidecar
    state. The sidecar is quiesced for the copy and keeps serving; the version is recorded only once the
    upload is durable. Rejections carry an error_code: sidecar_state_flag_off,
    sidecar_state_name_invalid, sidecar_state_unsupported (the entry has no data disk),
    sidecar_state_entry_mismatch, sidecar_state_size_mismatch and sidecar_state_limit are 400;
    sidecar_not_running and sidecar_state_busy (a save for this sidecar is already in flight) are 409;
    sidecar_state_failed is 500.

    Args:
        sandbox_id (str):
        entry (str):
        body (SidecarStateSaveRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SidecarStateVersion]
    """

    return sync_detailed(
        sandbox_id=sandbox_id,
        entry=entry,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    sandbox_id: str,
    entry: str,
    *,
    client: AuthenticatedClient,
    body: SidecarStateSaveRequest,
) -> Response[Union[Error, SidecarStateVersion]]:
    """Save sidecar state

     Save the data disk of one of the sandbox's sidecars as a new version of a named, team-scoped sidecar
    state. The sidecar is quiesced for the copy and keeps serving; the version is recorded only once the
    upload is durable. Rejections carry an error_code: sidecar_state_flag_off,
    sidecar_state_name_invalid, sidecar_state_unsupported (the entry has no data disk),
    sidecar_state_entry_mismatch, sidecar_state_size_mismatch and sidecar_state_limit are 400;
    sidecar_not_running and sidecar_state_busy (a save for this sidecar is already in flight) are 409;
    sidecar_state_failed is 500.

    Args:
        sandbox_id (str):
        entry (str):
        body (SidecarStateSaveRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Error, SidecarStateVersion]]
    """

    kwargs = _get_kwargs(
        sandbox_id=sandbox_id,
        entry=entry,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    sandbox_id: str,
    entry: str,
    *,
    client: AuthenticatedClient,
    body: SidecarStateSaveRequest,
) -> Optional[Union[Error, SidecarStateVersion]]:
    """Save sidecar state

     Save the data disk of one of the sandbox's sidecars as a new version of a named, team-scoped sidecar
    state. The sidecar is quiesced for the copy and keeps serving; the version is recorded only once the
    upload is durable. Rejections carry an error_code: sidecar_state_flag_off,
    sidecar_state_name_invalid, sidecar_state_unsupported (the entry has no data disk),
    sidecar_state_entry_mismatch, sidecar_state_size_mismatch and sidecar_state_limit are 400;
    sidecar_not_running and sidecar_state_busy (a save for this sidecar is already in flight) are 409;
    sidecar_state_failed is 500.

    Args:
        sandbox_id (str):
        entry (str):
        body (SidecarStateSaveRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Error, SidecarStateVersion]
    """

    return (
        await asyncio_detailed(
            sandbox_id=sandbox_id,
            entry=entry,
            client=client,
            body=body,
        )
    ).parsed
