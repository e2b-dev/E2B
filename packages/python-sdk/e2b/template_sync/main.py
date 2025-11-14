import os
from datetime import datetime
from typing import Callable, Optional

from e2b.api.client.client import AuthenticatedClient
from e2b.connection_config import ConnectionConfig

from e2b.api.client_sync import get_api_client
from e2b.template.consts import RESOLVE_SYMLINKS
from e2b.template.logger import LogEntry, LogEntryEnd, LogEntryStart
from e2b.template.main import TemplateBase, TemplateClass
from e2b.template.types import BuildInfo, InstructionType
from e2b.template_sync.build_api import (
    get_build_status,
    get_file_upload_link,
    request_build,
    trigger_build,
    upload_file,
    wait_for_build_finish,
)
from e2b.template.utils import read_dockerignore


class Template(TemplateBase):
    """
    Synchronous template builder for E2B sandboxes.
    """

    @staticmethod
    def _build(
        template: TemplateClass,
        api_client: AuthenticatedClient,
        alias: str,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ) -> BuildInfo:
        """
        Internal implementation of the template build process

        :param template: The template to build
        :param api_client: Authenticated API client
        :param alias: Alias name for the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process
        """
        if skip_cache:
            template._template._force = True

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

        instructions_with_hashes = template._template._instructions_with_hashes()

        # Upload files
        for index, file_upload in enumerate(instructions_with_hashes):
            if file_upload["type"] != InstructionType.COPY:
                continue

            args = file_upload.get("args", [])
            src = args[0] if len(args) > 0 else None
            force_upload = file_upload.get("forceUpload")
            files_hash = file_upload.get("filesHash", None)
            resolve_symlinks = file_upload.get("resolveSymlinks", RESOLVE_SYMLINKS)

            if src is None or files_hash is None:
                raise ValueError("Source path and files hash are required")

            stack_trace = None
            if index + 1 < len(template._template._stack_traces):
                stack_trace = template._template._stack_traces[index + 1]

            file_info = get_file_upload_link(
                api_client, template_id, files_hash, stack_trace
            )

            if (force_upload and file_info.url) or (
                file_info.present is False and file_info.url
            ):
                upload_file(
                    api_client,
                    src,
                    template._template._file_context_path,
                    file_info.url,
                    [
                        *template._template._file_ignore_patterns,
                        *read_dockerignore(template._template._file_context_path),
                    ],
                    resolve_symlinks,
                    stack_trace,
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

        trigger_build(
            api_client,
            template_id,
            build_id,
            template._template._serialize(instructions_with_hashes),
        )

        return BuildInfo(
            alias=alias,
            template_id=template_id,
            build_id=build_id,
        )

    @staticmethod
    def build(
        template: TemplateClass,
        alias: str,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure.

        :param template: The template to build
        :param alias: Alias name for the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process
        :param api_key: E2B API key for authentication
        :param domain: Domain of the E2B API

        Example
        ```python
        from e2b import Template

        template = (
            Template()
            .from_python_image('3')
            .copy('requirements.txt', '/home/user/')
            .run_cmd('pip install -r /home/user/requirements.txt')
        )

        Template.build(
            template,
            alias='my-python-env',
            cpu_count=2,
            memory_mb=1024
        )
        ```
        """
        try:
            if on_build_logs:
                on_build_logs(
                    LogEntryStart(
                        timestamp=datetime.now(),
                        message="Build started",
                    )
                )

            domain = domain or os.environ.get("E2B_DOMAIN", "e2b.dev")
            config = ConnectionConfig(
                domain=domain, api_key=api_key or os.environ.get("E2B_API_KEY")
            )
            api_client = get_api_client(
                config,
                require_api_key=True,
                require_access_token=False,
            )

            data = Template._build(
                template,
                api_client,
                alias,
                cpu_count,
                memory_mb,
                skip_cache,
                on_build_logs,
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
                data.template_id,
                data.build_id,
                on_build_logs,
                logs_refresh_frequency=TemplateBase._logs_refresh_frequency,
                stack_traces=template._template._stack_traces,
            )

            return data
        finally:
            if on_build_logs:
                on_build_logs(
                    LogEntryEnd(
                        timestamp=datetime.now(),
                        message="Build finished",
                    )
                )

    @staticmethod
    def build_in_background(
        template: TemplateClass,
        alias: str,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure without waiting for completion.

        :param template: The template to build
        :param alias: Alias name for the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param api_key: E2B API key for authentication
        :param domain: Domain of the E2B API
        :return: BuildInfo containing the template ID and build ID

        Example
        ```python
        from e2b import Template

        template = (
            Template()
            .from_python_image('3')
            .run_cmd('echo "test"')
            .set_start_cmd('echo "Hello"', 'sleep 1')
        )

        build_info = Template.build_in_background(
            template,
            alias='my-python-env',
            cpu_count=2,
            memory_mb=1024
        )
        ```
        """
        domain = domain or os.environ.get("E2B_DOMAIN", "e2b.dev")
        config = ConnectionConfig(
            domain=domain, api_key=api_key or os.environ.get("E2B_API_KEY")
        )
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        return Template._build(
            template,
            api_client,
            alias,
            cpu_count,
            memory_mb,
            skip_cache,
            on_build_logs,
        )

    @staticmethod
    def get_build_status(
        build_info: BuildInfo,
        logs_offset: int = 0,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
    ):
        """
        Get the status of a build.

        :param build_info: Build identifiers returned from build_in_background
        :param logs_offset: Offset for fetching logs
        :param api_key: E2B API key for authentication
        :param domain: Domain of the E2B API
        :return: TemplateBuild containing the build status and logs

        Example
        ```python
        from e2b import Template

        build_info = Template.build_in_background(template, alias='my-template')
        status = Template.get_build_status(build_info, logs_offset=0)
        ```
        """
        domain = domain or os.environ.get("E2B_DOMAIN", "e2b.dev")
        config = ConnectionConfig(
            domain=domain, api_key=api_key or os.environ.get("E2B_API_KEY")
        )
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        return get_build_status(
            api_client,
            build_info.template_id,
            build_info.build_id,
            logs_offset,
        )
