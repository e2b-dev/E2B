from datetime import datetime
from typing import Callable, List, Optional, Union

from typing_extensions import Unpack

from e2b.api.client.client import AuthenticatedClient
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.template.consts import RESOLVE_SYMLINKS
from e2b.template.logger import LogEntry, LogEntryEnd, LogEntryStart
from e2b.template.main import TemplateBase, TemplateClass
from e2b.template.types import BuildInfo, InstructionType, TemplateTagInfo
from e2b.template.utils import normalize_build_arguments, read_dockerignore

from .build_api import (
    assign_tags,
    check_alias_exists,
    remove_tags,
    get_build_status,
    get_file_upload_link,
    request_build,
    trigger_build,
    upload_file,
    wait_for_build_finish,
)
from e2b.api.client_async import get_api_client


class AsyncTemplate(TemplateBase):
    """
    Asynchronous template builder for E2B sandboxes.
    """

    @staticmethod
    async def _build(
        api_client: AuthenticatedClient,
        template: TemplateClass,
        name: str,
        tags: Optional[List[str]] = None,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
    ) -> BuildInfo:
        """
        Internal implementation of the template build process

        :param api_client: Authenticated API client
        :param template: The template to build
        :param name: Name for the template
        :param tags: Optional tags for the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process
        """
        if skip_cache:
            template._template._force = True

        # Create template
        if on_build_logs:
            tags_msg = f" with tags: {', '.join(tags)}" if tags else ""
            on_build_logs(
                LogEntry(
                    timestamp=datetime.now(),
                    level="info",
                    message=f"Requesting build for template: {name}{tags_msg}",
                )
            )

        response = await request_build(
            api_client,
            name=name,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            tags=tags,
        )

        template_id = response.template_id
        build_id = response.build_id
        response_tags = response.tags

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

            file_info = await get_file_upload_link(
                api_client, template_id, files_hash, stack_trace
            )

            if (force_upload and file_info.url) or (
                file_info.present is False and file_info.url
            ):
                await upload_file(
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

        await trigger_build(
            api_client,
            template_id,
            build_id,
            template._template._serialize(instructions_with_hashes),
        )

        return BuildInfo(
            template_id=template_id,
            build_id=build_id,
            alias=name,
            name=name,
            tags=response_tags,
        )

    @staticmethod
    async def build(
        template: TemplateClass,
        name: Optional[str] = None,
        *,
        alias: Optional[str] = None,
        tags: Optional[List[str]] = None,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        **opts: Unpack[ApiParams],
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure.

        :param template: The template to build
        :param name: Template name in 'name' or 'name:tag' format
        :param alias: (Deprecated) Alias name for the template. Use name instead.
        :param tags: Optional additional tags to assign to the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :param on_build_logs: Callback function to receive build logs during the build process

        Example
        ```python
        from e2b import AsyncTemplate

        template = (
            AsyncTemplate()
            .from_python_image('3')
            .copy('requirements.txt', '/home/user/')
            .run_cmd('pip install -r /home/user/requirements.txt')
        )

        # Build with single tag
        await AsyncTemplate.build(template, 'my-python-env:v1.0')

        # Build with multiple tags
        await AsyncTemplate.build(template, 'my-python-env', tags=['v1.1.0', 'stable'])
        ```
        """
        name = normalize_build_arguments(name, alias)

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

            data = await AsyncTemplate._build(
                api_client,
                template,
                name,
                tags=tags,
                cpu_count=cpu_count,
                memory_mb=memory_mb,
                skip_cache=skip_cache,
                on_build_logs=on_build_logs,
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
    async def build_in_background(
        template: TemplateClass,
        name: Optional[str] = None,
        *,
        alias: Optional[str] = None,
        tags: Optional[List[str]] = None,
        cpu_count: int = 2,
        memory_mb: int = 1024,
        skip_cache: bool = False,
        on_build_logs: Optional[Callable[[LogEntry], None]] = None,
        **opts: Unpack[ApiParams],
    ) -> BuildInfo:
        """
        Build and deploy a template to E2B infrastructure without waiting for completion.

        :param template: The template to build
        :param name: Template name in 'name' or 'name:tag' format
        :param alias: (Deprecated) Alias name for the template. Use name instead.
        :param tags: Optional additional tags to assign to the template
        :param cpu_count: Number of CPUs allocated to the sandbox
        :param memory_mb: Amount of memory in MB allocated to the sandbox
        :param skip_cache: If True, forces a complete rebuild ignoring cache
        :return: BuildInfo containing the template ID and build ID

        Example
        ```python
        from e2b import AsyncTemplate

        template = (
            AsyncTemplate()
            .from_python_image('3')
            .run_cmd('echo "test"')
            .set_start_cmd('echo "Hello"', 'sleep 1')
        )

        # Build with single tag
        build_info = await AsyncTemplate.build_in_background(template, 'my-python-env:v1.0')

        # Build with multiple tags
        build_info = await AsyncTemplate.build_in_background(template, 'my-python-env', tags=['v1.1.0', 'stable'])
        ```
        """
        name = normalize_build_arguments(name, alias)

        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        return await AsyncTemplate._build(
            api_client,
            template,
            name,
            tags=tags,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            skip_cache=skip_cache,
            on_build_logs=on_build_logs,
        )

    @staticmethod
    async def get_build_status(
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
        from e2b import AsyncTemplate

        build_info = await AsyncTemplate.build_in_background(template, alias='my-template')
        status = await AsyncTemplate.get_build_status(build_info, logs_offset=0)
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )
        return await get_build_status(
            api_client,
            build_info.template_id,
            build_info.build_id,
            logs_offset,
        )

    @staticmethod
    async def exists(
        name: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Check if a template with the given name exists.

        :param name: Template name to check
        :return: True if the name exists, False otherwise

        Example
        ```python
        from e2b import AsyncTemplate

        exists = await AsyncTemplate.exists('my-python-env')
        if exists:
            print('Template exists!')
        ```
        """

        return await AsyncTemplate.alias_exists(name, **opts)

    @staticmethod
    async def alias_exists(
        alias: str,
        **opts: Unpack[ApiParams],
    ) -> bool:
        """
        Check if a template with the given alias exists.

        Deprecated Use `exists` instead.

        :param alias: Template alias to check
        :return: True if the alias exists, False otherwise

        Example
        ```python
        from e2b import AsyncTemplate

        exists = await AsyncTemplate.alias_exists('my-python-env')
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

        return await check_alias_exists(api_client, alias)

    @staticmethod
    async def assign_tags(
        target_name: str,
        tags: Union[str, List[str]],
        **opts: Unpack[ApiParams],
    ) -> TemplateTagInfo:
        """
        Assign tag(s) to an existing template build.

        :param target_name: Template name in 'name:tag' format (the source build to tag from)
        :param tags: Tag or tags to assign
        :return: TemplateTagInfo with build_id and assigned tags

        Example
        ```python
        from e2b import AsyncTemplate

        # Assign a single tag
        result = await AsyncTemplate.assign_tags('my-template:v1.0', 'production')

        # Assign multiple tags
        result = await AsyncTemplate.assign_tags('my-template:v1.0', ['production', 'stable'])
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        normalized_tags = [tags] if isinstance(tags, str) else tags
        return await assign_tags(api_client, target_name, normalized_tags)

    @staticmethod
    async def remove_tags(
        name: str,
        tags: Union[str, List[str]],
        **opts: Unpack[ApiParams],
    ) -> None:
        """
        Remove tag(s) from a template.

        :param name: Template name
        :param tags: Tag or tags to remove

        Example
        ```python
        from e2b import AsyncTemplate

        # Remove a single tag
        await AsyncTemplate.remove_tags('my-template', 'production')

        # Remove multiple tags
        await AsyncTemplate.remove_tags('my-template', ['production', 'stable'])
        ```
        """
        config = ConnectionConfig(**opts)
        api_client = get_api_client(
            config,
            require_api_key=True,
            require_access_token=False,
        )

        normalized_tags = [tags] if isinstance(tags, str) else tags
        await remove_tags(api_client, name, normalized_tags)
