from http import HTTPStatus
from typing import Any, Optional, Union, cast

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.template_build_start_v2 import TemplateBuildStartV2
from ...types import UNSET, Response, Unset


def _get_kwargs(
    template_id: str,
    build_id: str,
    *,
    body: TemplateBuildStartV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": f"/v2/templates/{template_id}/builds/{build_id}",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: Union[AuthenticatedClient, Client], response: httpx.Response
) -> Optional[Union[Any, Error]]:
    if response.status_code == 202:
        response_202 = cast(Any, None)
        return response_202
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
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildStartV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Response[Union[Any, Error]]:
    """Start template build (v2)

     Start the build. With an Idempotency-Key, replays continue to work after the build has left the
    waiting state.

    Args:
        template_id (str):
        build_id (str):
        idempotency_key (Union[Unset, str]):
        body (TemplateBuildStartV2): Exactly one of fromImage or fromTemplate must be given and
            non-empty.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildStartV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Optional[Union[Any, Error]]:
    """Start template build (v2)

     Start the build. With an Idempotency-Key, replays continue to work after the build has left the
    waiting state.

    Args:
        template_id (str):
        build_id (str):
        idempotency_key (Union[Unset, str]):
        body (TemplateBuildStartV2): Exactly one of fromImage or fromTemplate must be given and
            non-empty.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        body=body,
        idempotency_key=idempotency_key,
    ).parsed


async def asyncio_detailed(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildStartV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Response[Union[Any, Error]]:
    """Start template build (v2)

     Start the build. With an Idempotency-Key, replays continue to work after the build has left the
    waiting state.

    Args:
        template_id (str):
        build_id (str):
        idempotency_key (Union[Unset, str]):
        body (TemplateBuildStartV2): Exactly one of fromImage or fromTemplate must be given and
            non-empty.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Union[Any, Error]]
    """

    kwargs = _get_kwargs(
        template_id=template_id,
        build_id=build_id,
        body=body,
        idempotency_key=idempotency_key,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    template_id: str,
    build_id: str,
    *,
    client: AuthenticatedClient,
    body: TemplateBuildStartV2,
    idempotency_key: Union[Unset, str] = UNSET,
) -> Optional[Union[Any, Error]]:
    """Start template build (v2)

     Start the build. With an Idempotency-Key, replays continue to work after the build has left the
    waiting state.

    Args:
        template_id (str):
        build_id (str):
        idempotency_key (Union[Unset, str]):
        body (TemplateBuildStartV2): Exactly one of fromImage or fromTemplate must be given and
            non-empty.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Union[Any, Error]
    """

    return (
        await asyncio_detailed(
            template_id=template_id,
            build_id=build_id,
            client=client,
            body=body,
            idempotency_key=idempotency_key,
        )
    ).parsed
