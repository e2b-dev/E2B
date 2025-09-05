from typing import Callable, Optional

from e2b.template import TemplateBase, TemplateClass
from e2b.template.types import LogEntry

import os
from datetime import datetime

from e2b.api import ApiClient
from e2b.connection_config import ConnectionConfig
from e2b.template_sync.build_api import (
    get_file_upload_link,
    request_build,
    trigger_build,
    upload_file,
    wait_for_build_finish,
)


class Template(TemplateBase):
    @staticmethod
    def build(
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
        client = ApiClient(
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

            response = request_build(
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

            instructions_with_hashes = template._template._calculate_hashes()

            # Prepare file uploads
            file_uploads = [
                {
                    "src": instruction["args"][0],
                    "dest": instruction["args"][1],
                    "filesHash": instruction.get("filesHash"),
                    "forceUpload": instruction.get("forceUpload"),
                }
                for instruction in instructions_with_hashes
                if instruction["type"] == "COPY"
            ]

            # Upload files
            for file_upload in file_uploads:
                file_info = get_file_upload_link(
                    api_client, template_id, file_upload["filesHash"]
                )

                if (file_upload["forceUpload"] and file_info.url) or (
                    file_info.present is False and file_info.url
                ):
                    upload_file(
                        file_upload["src"],
                        template._template._file_context_path,
                        file_info.url,
                    )
                    if on_build_logs:
                        on_build_logs(
                            LogEntry(
                                timestamp=datetime.now(),
                                level="info",
                                message=f"Uploaded '{file_upload['src']}'",
                            )
                        )
                else:
                    if on_build_logs:
                        on_build_logs(
                            LogEntry(
                                timestamp=datetime.now(),
                                level="info",
                                message=f"Skipping upload of '{file_upload['src']}', already cached",
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

            trigger_build(
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

            wait_for_build_finish(
                api_client,
                template_id,
                build_id,
                on_build_logs,
                logs_refresh_frequency=TemplateBase._logs_refresh_frequency,
            )
