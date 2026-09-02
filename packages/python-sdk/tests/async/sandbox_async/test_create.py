import asyncio
from typing import Any, cast
from uuid import uuid4

import httpx
import pytest

from e2b import AsyncSandbox, SandboxException, SandboxQuery, SandboxState, Secret
from e2b.api.client.models import (
    NewSandbox,
    SandboxAutoResumeConfig,
)
from e2b.api.client.types import UNSET
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.sandbox_api import build_iam_config


async def wait_for_state(
    sandbox: AsyncSandbox, state: SandboxState, timeout: float = 30
) -> None:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    current_state: SandboxState | None = None

    while loop.time() < deadline:
        current_state = (await sandbox.get_info()).state
        if current_state == state:
            return
        await asyncio.sleep(0.2)

    pytest.fail(f"sandbox did not reach {state}; last state was {current_state}")


async def wait_for_http_status(url: str, status: int, timeout: float = 30) -> None:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    current_status: int | None = None

    async with httpx.AsyncClient(timeout=5.0) as client:
        while loop.time() < deadline:
            try:
                current_status = (await client.get(url)).status_code
            except httpx.HTTPError:
                pass
            if current_status == status:
                return
            await asyncio.sleep(0.5)

    pytest.fail(f"endpoint did not return {status}; last status was {current_status}")


@pytest.mark.skip_debug()
async def test_start(async_sandbox):
    assert await async_sandbox.is_running()
    assert async_sandbox._envd_version is not None


@pytest.mark.skip_debug()
async def test_metadata(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=5, metadata={"test-key": "test-value"})

    paginator = AsyncSandbox.list(
        query=SandboxQuery(metadata={"test-key": "test-value"})
    )
    sandboxes = await paginator.next_items()

    for sbx_info in sandboxes:
        if sbx.sandbox_id == sbx_info.sandbox_id:
            assert sbx_info.metadata is not None
            assert sbx_info.metadata["test-key"] == "test-value"
            break
    else:
        assert False, "Sandbox not found"


@pytest.mark.skip_debug()
async def test_mcp_gateway_start_failure_kills_created_sandbox(template):
    metadata = {"mcp_gateway_cleanup_test_id": str(uuid4())}
    query = SandboxQuery(state=[SandboxState.RUNNING], metadata=metadata)
    remaining_sandboxes = []

    try:
        # The base template has no mcp-gateway binary, so gateway startup
        # reliably fails after the sandbox has been allocated.
        with pytest.raises(SandboxException, match="Failed to start MCP gateway"):
            await AsyncSandbox.create(
                template,
                timeout=60,
                metadata=metadata,
                mcp=cast(Any, {"invalid_server": {}}),
            )

        remaining_sandboxes = await AsyncSandbox.list(query=query).next_items()
        assert remaining_sandboxes == []
    finally:
        try:
            remaining_sandboxes = await AsyncSandbox.list(query=query).next_items()
        except Exception:
            pass
        for sandbox in remaining_sandboxes:
            await AsyncSandbox.kill(sandbox.sandbox_id)


def test_create_payload_serializes_auto_resume_enabled():
    body = NewSandbox(
        template_id="template-id",
        auto_pause=True,
        auto_resume=SandboxAutoResumeConfig(enabled=True),
    )

    assert body.to_dict()["autoPause"] is True
    assert body.to_dict()["autoResume"] == {"enabled": True}


def test_create_payload_deserializes_auto_resume_enabled():
    body = NewSandbox.from_dict(
        {
            "templateID": "template-id",
            "autoPause": False,
            "autoResume": {"enabled": False},
        }
    )

    assert isinstance(body.auto_resume, SandboxAutoResumeConfig)
    assert body.auto_resume.to_dict() == {"enabled": False}


def test_create_payload_serializes_iam_tokens():
    iam = build_iam_config(
        {
            "tokens": {
                "aws": {"audience": "sts.amazonaws.com", "token_type": "JWT-SVID"},
            },
        }
    )
    assert iam is not None

    body = NewSandbox(template_id="template-id", iam=iam)

    assert body.to_dict()["iam"] == {
        "tokens": {
            "aws": {"audience": "sts.amazonaws.com", "tokenType": "JWT-SVID"},
        },
    }


def test_create_payload_serializes_secret_iam_token():
    iam = build_iam_config(
        {
            "tokens": {
                "aws": Secret.iam_token(
                    audience="sts.amazonaws.com", token_type="JWT-SVID"
                ),
            },
        }
    )
    assert iam is not None

    body = NewSandbox(template_id="template-id", iam=iam)

    assert body.to_dict()["iam"] == {
        "tokens": {
            "aws": {"audience": "sts.amazonaws.com", "tokenType": "JWT-SVID"},
        },
    }


def test_create_payload_omits_iam_when_not_provided_or_empty():
    assert build_iam_config(None) is None
    assert build_iam_config({}) is None
    assert build_iam_config({"tokens": {}}) is None

    body = NewSandbox(template_id="template-id", iam=UNSET)

    assert "iam" not in body.to_dict()


def test_create_payload_rejects_malformed_iam_tokens():
    # The wire-format casing a user might copy from the JS example or a
    # serialized payload must fail with an actionable error, not a KeyError.
    with pytest.raises(InvalidArgumentException, match="token_type"):
        build_iam_config(
            cast(
                Any,
                {
                    "tokens": {
                        "aws": {
                            "audience": "sts.amazonaws.com",
                            "tokenType": "JWT-SVID",
                        },
                    },
                },
            )
        )

    with pytest.raises(InvalidArgumentException):
        build_iam_config(cast(Any, {"tokens": {"aws": None}}))

    # Non-string values must be rejected too, not serialized as null.
    with pytest.raises(InvalidArgumentException):
        build_iam_config(
            cast(Any, {"tokens": {"aws": {"audience": None, "token_type": "JWT-SVID"}}})
        )


@pytest.mark.skip_debug()
async def test_filesystem_only_auto_pause_rejects_auto_resume():
    # A filesystem-only auto-pause snapshot can only be resumed explicitly, so
    # combining keep_memory=False with auto_resume is rejected client-side.
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            timeout=3,
            lifecycle={
                "on_timeout": {"action": "pause", "keep_memory": False},
                "auto_resume": True,
            },
        )


@pytest.mark.skip_debug()
async def test_keep_memory_not_allowed_with_kill():
    # The discriminated union forbids keep_memory on action="kill" at type-check
    # time; the runtime guard rejects it for callers that bypass the type
    # (cast(Any, ...) feeds the deliberately type-invalid input).
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            timeout=3,
            lifecycle=cast(
                Any, {"on_timeout": {"action": "kill", "keep_memory": False}}
            ),
        )


@pytest.mark.skip_debug()
async def test_invalid_on_timeout_type_does_not_crash(async_sandbox_factory):
    # An untyped/invalid on_timeout (e.g. None) must not crash create; it falls
    # back to kill semantics like a missing on_timeout (the sandbox just starts).
    sbx = await async_sandbox_factory(
        timeout=10, lifecycle=cast(Any, {"on_timeout": None})
    )
    assert await sbx.is_running()


@pytest.mark.skip_debug()
async def test_keep_memory_none_defaults_to_full_memory(async_sandbox_factory):
    # An explicit None keep_memory must default to full memory (not filesystem-only):
    # the timeout auto-pause then resumes the SAME sandbox in place (memory restore),
    # so the boot id is unchanged. A changed boot id would mean None was wrongly
    # treated as filesystem-only (cold boot).
    sbx = await async_sandbox_factory(
        timeout=60,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": None}},
    )
    boot_before = (await sbx.files.read("/proc/sys/kernel/random/boot_id")).strip()

    await sbx.set_timeout(0)  # force the timeout auto-pause now
    for _ in range(150):
        if not await sbx.is_running():
            break
        await asyncio.sleep(0.2)
    assert not await sbx.is_running()

    resumed = await sbx.connect()
    assert resumed.sandbox_id == sbx.sandbox_id  # same sandbox
    boot_after = (await resumed.files.read("/proc/sys/kernel/random/boot_id")).strip()
    assert boot_after == boot_before  # memory restore in place, not a cold boot


@pytest.mark.skip_debug()
@pytest.mark.timeout(90)
async def test_auto_pause_filesystem_only_reboots(async_sandbox_factory):
    # keep_memory=False makes the timeout auto-pause filesystem-only, so resuming
    # cold-boots the sandbox from disk.
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}},
    )

    marker = "auto-pause-fs-only"
    await sandbox.files.write("/home/user/auto-pause-marker.txt", marker)
    boot_before = (await sandbox.files.read("/proc/sys/kernel/random/boot_id")).strip()

    await wait_for_state(sandbox, SandboxState.PAUSED)

    # A filesystem-only snapshot cannot auto-resume on traffic; connect resumes
    # it by cold-booting.
    resumed = await sandbox.connect()

    persisted = (await resumed.files.read("/home/user/auto-pause-marker.txt")).strip()
    assert persisted == marker

    boot_after = (await resumed.files.read("/proc/sys/kernel/random/boot_id")).strip()
    assert boot_after != boot_before


@pytest.mark.skip_debug()
@pytest.mark.timeout(90)
async def test_auto_pause_without_auto_resume_requires_connect(async_sandbox_factory):
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": False},
    )

    await wait_for_state(sandbox, SandboxState.PAUSED)
    assert not await sandbox.is_running()

    await sandbox.connect()

    await wait_for_state(sandbox, SandboxState.RUNNING)
    assert await sandbox.is_running()


@pytest.mark.skip_debug()
@pytest.mark.timeout(90)
async def test_auto_resume_wakes_on_http_request(async_sandbox_factory):
    sandbox = await async_sandbox_factory(
        timeout=3,
        lifecycle={"on_timeout": "pause", "auto_resume": True},
    )

    cmd = await sandbox.commands.run("python3 -m http.server 8000", background=True)
    try:
        await wait_for_state(sandbox, SandboxState.PAUSED)

        url = f"https://{sandbox.get_host(8000)}"
        await wait_for_http_status(url, 200)

        await wait_for_state(sandbox, SandboxState.RUNNING)
        assert await sandbox.is_running()
    finally:
        try:
            await cmd.kill()
        except Exception:
            pass
