from typing import Callable, Optional

from e2b.template.main import TemplateBase, TemplateClass

import os
from datetime import datetime

from e2b.connection_config import ConnectionConfig
from e2b.api import AsyncApiClient
from e2b.template.types import LogEntry, InstructionType
from .build_api import (
    get_file_upload_link,
    request_build,
    trigger_build,
    upload_file,
    wait_for_build_finish,
)


class AsyncTemplate(TemplateBase):
    @staticmethod
    async def build(
        template: TemplateClass,
        alias: str,
        cpu_count: int,
        memory_mb: int,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> None:
        domain = domain or os.environ.get("E2B_DOMAIN", "e2b.dev")
        config = ConnectionConfig(
            domain=domain, api_key=api_key or os.environ.get("E2B_API_KEY")
        )
        client = AsyncApiClient(
            config,
            require_api_key=True,
            require_access_token=False,
            limits=TemplateBase._limits,
        )

        if skip_cache:
            template._template._force = True

        with client as api_client:
            # Create template
            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=datetime.now(),
                        level="info",
                        message=f"Requesting build for template: {alias}",
                    )
                )

            response = await request_build(
                api_client,
                name=alias,
                cpu_count=cpu_count,
                memory_mb=memory_mb,
            )

            template_id = response.template_id
            build_id = response.build_id

            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=datetime.now(),
                        level="info",
                        message=f"Template created with ID: {template_id}, Build ID: {build_id}",
                    )
                )

            instructions_with_hashes = template._template._instructions_with_hashes()

            # Upload files
            for index, file_upload in enumerate(instructions_with_hashes):
                if file_upload["type"] != InstructionType.COPY:
                    continue

                args = file_upload.get("args", [])
                src = args[0] if len(args) > 0 else None
                force_upload = file_upload.get("forceUpload")
                files_hash = file_upload.get("filesHash", None)

                if src is None or files_hash is None:
                    raise ValueError("Source path and files hash are required")

                stack_trace = None
                if index + 1 < len(template._template._stack_traces):
                    stack_trace = template._template._stack_traces[index + 1]

                file_info = await get_file_upload_link(
                    api_client, template_id, files_hash, stack_trace
                )

                if (force_upload and file_info.url) or (
                    file_info.present is False and file_info.url
                ):
                    await upload_file(
                        src,
                        template._template._file_context_path,
                        file_info.url,
                    )
                    if on_build_logs:
                        on_build_logs(
                            LogEntry(
                                timestamp=datetime.now(),
                                level="info",
                                message=f"Uploaded '{src}'",
                            )
                        )
                else:
                    if on_build_logs:
                        on_build_logs(
                            LogEntry(
                                timestamp=datetime.now(),
                                level="info",
                                message=f"Skipping upload of '{src}', already cached",
                            )
                        )

            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=datetime.now(),
                        level="info",
                        message="All file uploads completed",
                    )
                )

            # Start build
            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=datetime.now(),
                        level="info",
                        message="Starting building...",
                    )
                )

            await trigger_build(
                api_client,
                template_id,
                build_id,
                template._template._serialize(instructions_with_hashes),
            )

            if on_build_logs:
                on_build_logs(
                    LogEntry(
                        timestamp=datetime.now(),
                        level="info",
                        message="Waiting for logs...",
                    )
                )

            await wait_for_build_finish(
                api_client,
                template_id,
                build_id,
                on_build_logs,
                logs_refresh_frequency=TemplateBase._logs_refresh_frequency,
                stack_traces=template._template._stack_traces,
            )
