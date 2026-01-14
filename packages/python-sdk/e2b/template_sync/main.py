from datetime import datetime
from typing import Callable, List, Optional, Union

from typing_extensions import Unpack

from e2b.api.client.client import AuthenticatedClient
from e2b.connection_config import ApiParams, ConnectionConfig

from e2b.api.client_sync import get_api_client
from e2b.template.consts import RESOLVE_SYMLINKS
from e2b.template.logger import LogEntry, LogEntryEnd, LogEntryStart
from e2b.template.main import TemplateBase, TemplateClass
from e2b.template.types import BuildInfo, InstructionType, TagInfo, normalize_names
from e2b.template_sync.build_api import (
    assign_tag,
    check_alias_exists,
    delete_tag,
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
        names: List[str],
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ) -> BuildInfo:
        """
        Internal implementation of the template build process

        :param template: The template to build
        :param api_client: Authenticated API client
        :param names: Names for the template in 'alias:tag' format
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process
        """
        if skip_cache:
            template._template._force = True

        # Create template
        template_identifier = ", ".join(names)
        if on_build_logs:
            on_build_logs(
                LogEntry(
                    timestamp=datetime.now(),
                    level="info",
                    message=f"Requesting build for template: {template_identifier}",
                )
            )

        response = request_build(
            api_client,
            names=names,
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
            template_id=template_id,
            build_id=build_id,
            names=names,
        )

    @staticmethod
    def build(
        template: TemplateClass,
        names: Optional[Union[str, List[str]]] = None,
        *,
        alias: Optional[str] = None,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        **opts: Unpack[ApiParams],
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure.

        :param template: The template to build
        :param names: Name(s) for the template in 'alias:tag' format (string or list)
        :param alias: (Deprecated) Alias name for the template. Use names instead.
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process

        Example
        ```python
        from e2b import Template

        template = (
            Template()
            .from_python_image('3')
            .copy('requirements.txt', '/home/user/')
            .run_cmd('pip install -r /home/user/requirements.txt')
        )

        # New way - single name
        Template.build(template, 'my-python-env:v1.0')

        # New way - multiple names
        Template.build(template, ['my-python-env:v1.0', 'my-python-env:latest'])

        # Old way (deprecated)
        Template.build(template, alias='my-python-env')
        ```
        """
        names_list = normalize_names(names, alias)

        try:
            if on_build_logs:
                on_build_logs(
                    LogEntryStart(
                        timestamp=datetime.now(),
                        message="Build started",
                    )
                )

            config = ConnectionConfig(**opts)
            api_client = get_api_client(
                config,
                require_api_key=True,
                require_access_token=False,
            )

            data = Template._build(
                template,
                api_client,
                cpu_count=cpu_count,
                memory_mb=memory_mb,
                skip_cache=skip_cache,
                on_build_logs=on_build_logs,
                names=names_list,
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
        names: Optional[Union[str, List[str]]] = None,
        *,
        alias: Optional[str] = None,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        **opts: Unpack[ApiParams],
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure without waiting for completion.

        :param template: The template to build
        :param names: Name(s) for the template in 'alias:tag' format (string or list)
        :param alias: (Deprecated) Alias name for the template. Use names instead.
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
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

        # New way - single name
        build_info = Template.build_in_background(template, 'my-python-env:v1.0')

        # New way - multiple names
        build_info = Template.build_in_background(template, ['my-python-env:v1.0', 'my-python-env:latest'])

        # Old way (deprecated)
        build_info = Template.build_in_background(template, alias='my-python-env')
        ```
        """
        names_list = normalize_names(names, alias)

        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        return Template._build(
            template,
            api_client,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            skip_cache=skip_cache,
            on_build_logs=on_build_logs,
            names=names_list,
        )

    @staticmethod
    def get_build_status(
        build_info: BuildInfo,
        logs_offset: int = 0,
        **opts: Unpack[ApiParams],
    ):
        """
        Get the status of a build.

        :param build_info: Build identifiers returned from build_in_background
        :param logs_offset: Offset for fetching logs
        :return: TemplateBuild containing the build status and logs

        Example
        ```python
        from e2b import Template

        build_info = Template.build_in_background(template, alias='my-template')
        status = Template.get_build_status(build_info, logs_offset=0)
        ```
        """
        config = ConnectionConfig(**opts)
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

    @staticmethod
    def alias_exists(
        alias: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Check if a template with the given alias exists.

        :param alias: Template alias to check
        :return: True if the alias exists, False otherwise

        Example
        ```python
        from e2b import Template

        exists = Template.alias_exists('base')
        if exists:
            print('Template exists!')
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        return check_alias_exists(api_client, alias)

    @staticmethod
    def assign_tag(
        target: str,
        names: Union[str, List[str]],
        **opts: Unpack[ApiParams],
    ) -> TagInfo:
        """
        Assign tag(s) to an existing template build.

        :param target: Target template in 'alias:tag' format (the source build)
        :param names: Tag(s) to assign in 'alias:tag' format (string or list)
        :return: TagInfo with build_id and assigned tags

        Example
        ```python
        from e2b import Template

        # Assign a single tag
        result = Template.assign_tag('my-template:v1.0', 'my-template:production')

        # Assign multiple tags
        result = Template.assign_tag('my-template:v1.0', ['my-template:production', 'my-template:stable'])
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        names_list = [names] if isinstance(names, str) else names
        return assign_tag(api_client, target, names_list)

    @staticmethod
    def delete_tag(
        name: str,
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Delete a tag from a template.

        :param name: Template tag in 'alias:tag' format to delete

        Example
        ```python
        from e2b import Template

        Template.delete_tag('my-template:production')
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        delete_tag(api_client, name)
