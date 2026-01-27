import time
from types import TracebackType
from typing import Callable, Optional, List, Union

import httpx

from e2b.api import handle_api_exception
from e2b.api.client.api.templates import (
    post_v3_templates,
    get_templates_template_id_files_hash,
    post_v_2_templates_template_id_builds_build_id,
    get_templates_template_id_builds_build_id_status,
    get_templates_aliases_alias,
)
from e2b.api.client.api.tags import (
    post_templates_tags,
    delete_templates_tags,
)
from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.models import (
    TemplateBuildRequestV3,
    TemplateBuildStartV2,
    TemplateBuildFileUpload,
    Error,
    AssignTemplateTagsRequest,
    DeleteTemplateTagsRequest,
)
from e2b.api.client.types import UNSET, Unset
from e2b.exceptions import BuildException, FileUploadException, TemplateException
from e2b.template.logger import LogEntry
from e2b.template.types import (
    TemplateType,
    BuildStatusReason,
    TemplateBuildStatus,
    TemplateBuildStatusResponse,
    TemplateTagInfo,
)
from e2b.template.utils import get_build_step_index, tar_file_stream


def request_build(
    client: AuthenticatedClient,
    name: str,
    tags: Optional[List[str]],
    cpu_count: int,
    memory_mb: int,
):
    res = post_v3_templates.sync_detailed(
        client=client,
        body=TemplateBuildRequestV3(
            name=name,
            tags=tags if tags else UNSET,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
        ),
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, BuildException)

    if isinstance(res.parsed, Error):
        raise BuildException(f"API error: {res.parsed.message}")

    if res.parsed is None:
        raise BuildException("Failed to request build")

    return res.parsed


def get_file_upload_link(
    client: AuthenticatedClient,
    template_id: str,
    files_hash: str,
    stack_trace: Optional[TracebackType] = None,
) -> TemplateBuildFileUpload:
    res = get_templates_template_id_files_hash.sync_detailed(
        template_id=template_id,
        hash_=files_hash,
        client=client,
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, FileUploadException, stack_trace)

    if isinstance(res.parsed, Error):
        raise FileUploadException(f"API error: {res.parsed.message}").with_traceback(
            stack_trace
        )

    if res.parsed is None:
        raise FileUploadException("Failed to get file upload link").with_traceback(
            stack_trace
        )

    return res.parsed


def upload_file(
    api_client: AuthenticatedClient,
    file_name: str,
    context_path: str,
    url: str,
    ignore_patterns: List[str],
    resolve_symlinks: bool,
    stack_trace: Optional[TracebackType],
):
    try:
        tar_buffer = tar_file_stream(
            file_name, context_path, ignore_patterns, resolve_symlinks
        )
        client = api_client.get_httpx_client()
        response = client.put(url, content=tar_buffer.getvalue())
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise FileUploadException(f"Failed to upload file: {e}").with_traceback(
            stack_trace
        )
    except Exception as e:
        raise FileUploadException(f"Failed to upload file: {e}").with_traceback(
            stack_trace
        )


def trigger_build(
    client: AuthenticatedClient,
    template_id: str,
    build_id: str,
    template: TemplateType,
) -> None:
    # Convert template dict to TemplateBuildStartV2 model using from_dict
    template_data = TemplateBuildStartV2.from_dict(template)

    res = post_v_2_templates_template_id_builds_build_id.sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        body=template_data,
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, BuildException)


def _map_log_entry(entry) -> LogEntry:
    """Map API log entry to LogEntry type."""
    return LogEntry(
        timestamp=entry.timestamp,
        level=entry.level.value,
        message=entry.message,
    )


def _map_build_status_reason(reason) -> Optional[BuildStatusReason]:
    """Map API build status reason to custom BuildStatusReason type."""
    if reason is None or isinstance(reason, Unset):
        return None
    return BuildStatusReason(
        message=reason.message,
        step=reason.step if not isinstance(reason.step, Unset) else None,
        log_entries=[
            _map_log_entry(e)
            for e in (
                reason.log_entries
                if not isinstance(reason.log_entries, Unset) and reason.log_entries
                else []
            )
        ],
    )


def get_build_status(
    client: AuthenticatedClient, template_id: str, build_id: str, logs_offset: int
) -> TemplateBuildStatusResponse:
    res = get_templates_template_id_builds_build_id_status.sync_detailed(
        template_id=template_id,
        build_id=build_id,
        client=client,
        logs_offset=logs_offset,
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, BuildException)

    if isinstance(res.parsed, Error):
        raise BuildException(f"API error: {res.parsed.message}")

    if res.parsed is None:
        raise BuildException("Failed to get build status")

    return TemplateBuildStatusResponse(
        build_id=res.parsed.build_id,
        template_id=res.parsed.template_id,
        status=TemplateBuildStatus(res.parsed.status.value),
        log_entries=[_map_log_entry(e) for e in res.parsed.log_entries],
        logs=res.parsed.logs,
        reason=_map_build_status_reason(res.parsed.reason),
    )


def wait_for_build_finish(
    client: AuthenticatedClient,
    template_id: str,
    build_id: str,
    on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    logs_refresh_frequency: float = 0.2,
    stack_traces: List[Union[TracebackType, None]] = [],
):
    logs_offset = 0
    status = TemplateBuildStatus.BUILDING

    while status in [TemplateBuildStatus.BUILDING, TemplateBuildStatus.WAITING]:
        build_status = get_build_status(client, template_id, build_id, logs_offset)

        logs_offset += len(build_status.log_entries)

        for log_entry in build_status.log_entries:
            if on_build_logs:
                on_build_logs(log_entry)

        status = build_status.status

        if status == TemplateBuildStatus.READY:
            return

        elif status == TemplateBuildStatus.WAITING:
            pass

        elif status == TemplateBuildStatus.ERROR:
            traceback = None
            if build_status.reason and build_status.reason.step:
                # Find the corresponding stack trace for the failed step
                step_index = get_build_step_index(
                    build_status.reason.step, len(stack_traces)
                )
                if step_index < len(stack_traces):
                    traceback = stack_traces[step_index]

            raise BuildException(
                build_status.reason.message if build_status.reason else "Build failed"
            ).with_traceback(traceback)

        # Wait for a short period before checking the status again
        time.sleep(logs_refresh_frequency)

    raise BuildException("Unknown build error occurred.")


def check_alias_exists(client: AuthenticatedClient, alias: str) -> bool:
    """
    Check if a template with the given alias exists.

    Args:
        client: Authenticated API client
        alias: Template alias to check

    Returns:
        True if the alias exists, False otherwise
    """
    res = get_templates_aliases_alias.sync_detailed(
        alias=alias,
        client=client,
    )

    # If we get a NotFound, the alias doesn't exist
    if res.status_code == 404:
        return False

    # If we get a Forbidden, alias exists, but you are not owner
    if res.status_code == 403:
        return True

    # Handle other errors
    if res.status_code >= 300:
        raise handle_api_exception(res, TemplateException)

    # If we get Ok with data, you are owner and the alias exists
    return res.parsed is not None


def assign_tags(
    client: AuthenticatedClient, target_name: str, tags: List[str]
) -> TemplateTagInfo:
    """
    Assign tag(s) to an existing template build.

    Args:
        client: Authenticated API client
        target_name: Template name in 'name:tag' format (the source build to tag from)
        tags: Tags to assign

    Returns:
        TemplateTagInfo with build_id and assigned tags
    """
    res = post_templates_tags.sync_detailed(
        client=client,
        body=AssignTemplateTagsRequest(
            target=target_name,
            tags=tags,
        ),
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, TemplateException)

    if isinstance(res.parsed, Error):
        raise TemplateException(f"API error: {res.parsed.message}")

    if res.parsed is None:
        raise TemplateException("Failed to assign tags")

    return TemplateTagInfo(
        build_id=str(res.parsed.build_id),
        tags=res.parsed.tags,
    )


def remove_tags(client: AuthenticatedClient, name: str, tags: List[str]) -> None:
    """
    Remove tag(s) from a template.

    Args:
        client: Authenticated API client
        name: Template name
        tags: List of tags to remove
    """
    res = delete_templates_tags.sync_detailed(
        client=client,
        body=DeleteTemplateTagsRequest(
            name=name,
            tags=tags,
        ),
    )

    if res.status_code >= 300:
        raise handle_api_exception(res, TemplateException)
