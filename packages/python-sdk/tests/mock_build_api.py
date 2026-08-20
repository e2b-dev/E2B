"""In-memory mock of the template build control-plane API.

Mirrors packages/js-sdk/tests/template/mockBuildApi.ts: builds are simulated
synchronously at trigger time (one log entry per step) and drained through
status polling, the `base` alias is pre-seeded, and aliases/tags are tracked
in memory. The mock is installed by monkeypatching the build API functions
in the sync/async `main` modules (the same seam the stacktrace tests use),
so specialized fixtures can still override individual functions.
"""

from dataclasses import dataclass, field
from datetime import datetime
from types import SimpleNamespace
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from e2b.exceptions import BuildException, TemplateException
from e2b.template.logger import LogEntry
from e2b.template.types import (
    BuildStatusReason,
    InstructionType,
    TemplateBuildStatus,
    TemplateBuildStatusResponse,
    TemplateTag,
    TemplateTagInfo,
)

# Users that exist in the base image, like on the real build backend.
_VALID_USERS = {"root", "user"}


@dataclass
class MockBuild:
    template_id: str
    build_id: str
    alias: str
    tags: List[str]
    triggered: bool
    log_entries: List[LogEntry] = field(default_factory=list)
    final_status: TemplateBuildStatus = TemplateBuildStatus.READY
    reason: Optional[BuildStatusReason] = None
    created_at: datetime = field(default_factory=datetime.now)


def _log_entry(message: str) -> LogEntry:
    return LogEntry(timestamp=datetime.now(), level="info", message=message)


def _split_name(name: str) -> Optional[Tuple[str, Optional[str]]]:
    if ":" not in name:
        return (name, None) if name else None
    alias, _, tag = name.partition(":")
    if not alias or not tag:
        return None
    return (alias, tag)


class MockBuildAPI:
    def __init__(self):
        # Builds keyed by build ID; template IDs keyed by alias.
        self.builds: Dict[str, MockBuild] = {}
        self.templates: Dict[str, str] = {}
        self._seed_template("base")

    def _seed_template(self, alias: str) -> None:
        build = MockBuild(
            template_id=str(uuid4()),
            build_id=str(uuid4()),
            alias=alias,
            tags=["latest"],
            triggered=True,
            log_entries=[_log_entry("Build finished")],
        )
        self.builds[build.build_id] = build
        self.templates[alias] = build.template_id

    def _latest_build_for_alias(self, alias: str) -> Optional[MockBuild]:
        latest = None
        for build in self.builds.values():
            if build.alias == alias:
                latest = build
        return latest

    def request_build(self, client, name, tags, cpu_count, memory_mb):
        parsed = _split_name(name)
        if parsed is None:
            raise BuildException(f"Invalid template name: '{name}'")

        alias, tag = parsed
        template_id = self.templates.setdefault(alias, str(uuid4()))

        all_tags = ([tag] if tag else []) + (tags or [])
        build = MockBuild(
            template_id=template_id,
            build_id=str(uuid4()),
            alias=alias,
            tags=all_tags,
            triggered=False,
        )
        self.builds[build.build_id] = build

        return SimpleNamespace(
            template_id=template_id, build_id=build.build_id, tags=all_tags
        )

    def get_file_upload_link(self, client, template_id, files_hash, stack_trace=None):
        # Reporting every hash as cached (with no upload URL) skips uploads.
        return SimpleNamespace(present=True, url=None)

    def trigger_build(self, client, template_id, build_id, template) -> None:
        build = self.builds.get(build_id)
        if build is None or build.template_id != template_id:
            raise BuildException("Build not found")

        # Simulate the build synchronously: one log entry per step.
        from_value = template.get("fromImage") or template.get("fromTemplate") or "base"
        build.log_entries.append(_log_entry(f"FROM {from_value}"))
        for index, step in enumerate(template.get("steps") or []):
            step_type = InstructionType(step.get("type")).value
            args = step.get("args") or []
            # RUN steps carry the user in args[1]; only users that exist in
            # the base image are accepted, like the real build backend.
            user = args[1] if step_type == "RUN" and len(args) > 1 else None
            if user is not None and user not in _VALID_USERS:
                build.final_status = TemplateBuildStatus.ERROR
                build.reason = BuildStatusReason(
                    message=f"failed to run command '{args[0]}': command failed: "
                    f"unauthenticated: invalid username: '{user}'",
                    step=str(index + 1),
                )
                break
            build.log_entries.append(
                _log_entry(f"Step {index + 1}: {step_type} {' '.join(args)}")
            )
        if build.final_status != TemplateBuildStatus.ERROR:
            build.log_entries.append(_log_entry("Build finished"))
        build.triggered = True

    def get_build_status(
        self, client, template_id, build_id, logs_offset
    ) -> TemplateBuildStatusResponse:
        build = self.builds.get(build_id)
        if build is None or build.template_id != template_id:
            raise BuildException("Build not found")

        log_entries = build.log_entries[logs_offset:]

        # Deliver the pending log entries first (status `building`), then
        # report the final status once they are drained.
        if not build.triggered:
            status = TemplateBuildStatus.WAITING
        elif log_entries:
            status = TemplateBuildStatus.BUILDING
        else:
            status = build.final_status

        return TemplateBuildStatusResponse(
            build_id=build.build_id,
            template_id=build.template_id,
            status=status,
            log_entries=log_entries,
            logs=[entry.message for entry in log_entries],
            reason=build.reason if status == TemplateBuildStatus.ERROR else None,
        )

    def check_alias_exists(self, client, alias) -> bool:
        return alias in self.templates

    def assign_tags(self, client, target_name, tags) -> TemplateTagInfo:
        parsed = _split_name(target_name)
        if parsed is None:
            raise TemplateException(f"Invalid target: '{target_name}'")

        build = self._latest_build_for_alias(parsed[0])
        if build is None:
            raise TemplateException("Template not found")

        # Tags may be bare ('production') or namespaced ('alias:production');
        # the API returns and stores just the tag portion.
        assigned = []
        for tag in tags:
            parsed_tag = _split_name(tag)
            if parsed_tag is None:
                raise TemplateException(f"Invalid tag: '{tag}'")
            assigned.append(parsed_tag[1] or parsed_tag[0])

        build.tags.extend(assigned)

        return TemplateTagInfo(build_id=build.build_id, tags=assigned)

    def remove_tags(self, client, name, tags) -> None:
        build = self._latest_build_for_alias(name)
        if build is None:
            raise TemplateException("Template not found")

        build.tags = [tag for tag in build.tags if tag not in tags]

    def get_template_tags(self, client, template_id_or_name) -> List[TemplateTag]:
        template_builds = [
            build
            for build in self.builds.values()
            if build.template_id == template_id_or_name
        ]
        if not template_builds:
            raise TemplateException("Template not found")

        return [
            TemplateTag(tag=tag, build_id=build.build_id, created_at=build.created_at)
            for build in template_builds
            for tag in build.tags
        ]

    _SYNC_FUNCTIONS = (
        "request_build",
        "get_file_upload_link",
        "trigger_build",
        "get_build_status",
        "check_alias_exists",
        "assign_tags",
        "remove_tags",
        "get_template_tags",
    )

    def install_sync(self, monkeypatch) -> None:
        import e2b.template_sync.build_api as build_api_mod
        import e2b.template_sync.main as main_mod

        for name in self._SYNC_FUNCTIONS:
            monkeypatch.setattr(main_mod, name, getattr(self, name))
        # wait_for_build_finish polls get_build_status through its own module.
        monkeypatch.setattr(build_api_mod, "get_build_status", self.get_build_status)

    def install_async(self, monkeypatch) -> None:
        import e2b.template_async.build_api as build_api_mod
        import e2b.template_async.main as main_mod

        def as_async(func):
            async def wrapper(*args, **kwargs):
                return func(*args, **kwargs)

            return wrapper

        for name in self._SYNC_FUNCTIONS:
            monkeypatch.setattr(main_mod, name, as_async(getattr(self, name)))
        # wait_for_build_finish polls get_build_status through its own module.
        monkeypatch.setattr(
            build_api_mod, "get_build_status", as_async(self.get_build_status)
        )
