import io
import os
import tarfile
import time
from glob import glob
from types import TracebackType
from typing import Callable, Literal, Optional, List

import httpx

from e2b.api import handle_api_exception
from e2b.api.client.api.templates import (
    post_v2_templates,
    get_templates_template_id_files_hash,
    post_v_2_templates_template_id_builds_build_id,
    get_templates_template_id_builds_build_id_status,
)
from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.models import (
    TemplateBuildRequestV2,
    TemplateBuildStartV2,
    TemplateBuildFileUpload,
    TemplateBuild,
    Error,
)
from e2b.exceptions import BuildException, FileUploadException
from e2b.template.logger import LogEntry
from e2b.template.types import TemplateType
from e2b.template.utils import get_build_step_index


def request_build(
    client: AuthenticatedClient, name: str, cpu_count: int, memory_mb: int
):
    res = post_v2_templates.sync_detailed(
        client=client,
        body=TemplateBuildRequestV2(
            alias=name,
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
    file_name: str,
    context_path: str,
    url: str,
    resolve_symlinks: bool,
    stack_trace: Optional[TracebackType],
):
    tar_buffer = io.BytesIO()

    try:
        with tarfile.open(
            fileobj=tar_buffer,
            mode="w:gz",
            dereference=resolve_symlinks,
        ) as tar:
            src_path = os.path.join(context_path, file_name)
            files = glob(src_path, recursive=True)
            for file in files:
                arcname = os.path.relpath(file, context_path)
                tar.add(file, arcname=arcname)
    except Exception as e:
        raise FileUploadException(f"Failed to create tar file: {e}").with_traceback(
            stack_trace
        )

    try:
        with httpx.Client() as client:
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


def get_build_status(
    client: AuthenticatedClient, template_id: str, build_id: str, logs_offset: int
) -> TemplateBuild:
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

    return res.parsed


def wait_for_build_finish(
    client: AuthenticatedClient,
    template_id: str,
    build_id: str,
    on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    logs_refresh_frequency: float = 0.2,
    stack_traces: List[TracebackType] = [],
):
    logs_offset = 0
    status: Literal["building", "waiting", "ready", "error"] = "building"

    while status in ["building", "waiting"]:
        build_status = get_build_status(client, template_id, build_id, logs_offset)

        logs_offset += len(build_status.log_entries)

        for log_entry in build_status.log_entries:
            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=log_entry.timestamp,
                        level=log_entry.level.value,
                        message=log_entry.message,
                    )
                )

        status = build_status.status.value

        if status == "ready":
            return

        elif status == "waiting":
            pass

        elif status == "error":
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
