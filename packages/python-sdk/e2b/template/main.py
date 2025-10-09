import json
from typing import Dict, List, Optional, Union, Literal
from pathlib import Path

from httpx import Limits

from e2b.template.consts import STACK_TRACE_DEPTH, RESOLVE_SYMLINKS
from e2b.template.dockerfile_parser import parse_dockerfile
from e2b.template.readycmd import ReadyCmd
from e2b.template.types import (
    CopyItem,
    Instruction,
    TemplateType,
    RegistryConfig,
    InstructionType,
)
from e2b.template.utils import (
    calculate_files_hash,
    get_caller_directory,
    pad_octal,
    read_dockerignore,
    read_gcp_service_account_json,
    get_caller_frame,
)
from types import TracebackType


class TemplateBuilder:
    def __init__(self, template: "TemplateBase"):
        self._template = template

    def copy(
        self,
        src: Union[Union[str, Path], List[Union[str, Path]]],
        dest: Union[str, Path],
        force_upload: Optional[Literal[True]] = None,
        user: Optional[str] = None,
        mode: Optional[int] = None,
        resolve_symlinks: Optional[bool] = None,
    ) -> "TemplateBuilder":
        srcs = [src] if isinstance(src, (str, Path)) else src

        for src_item in srcs:
            args = [
                str(src_item),
                str(dest),
                user or "",
                pad_octal(mode) if mode else "",
            ]

            instruction: Instruction = {
                "type": InstructionType.COPY,
                "args": args,
                "force": force_upload or self._template._force_next_layer,
                "forceUpload": force_upload,
                "resolveSymlinks": resolve_symlinks,
            }

            self._template._instructions.append(instruction)

        self._template._collect_stack_trace()
        return self

    def copy_items(self, items: List[CopyItem]) -> "TemplateBuilder":
        self._template._run_in_new_stack_trace_context(
            lambda: [
                self.copy(
                    item["src"],
                    item["dest"],
                    item.get("forceUpload"),
                    item.get("user"),
                    item.get("mode"),
                    item.get("resolveSymlinks"),
                )
                for item in items
            ]
        )
        return self

    def remove(
        self,
        path: Union[Union[str, Path], List[Union[str, Path]]],
        force: bool = False,
        recursive: bool = False,
    ) -> "TemplateBuilder":
        paths = [path] if isinstance(path, (str, Path)) else path
        args = ["rm"]
        if recursive:
            args.append("-r")
        if force:
            args.append("-f")
        args.extend([str(p) for p in paths])

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def rename(
        self, src: Union[str, Path], dest: Union[str, Path], force: bool = False
    ) -> "TemplateBuilder":
        args = ["mv", str(src), str(dest)]
        if force:
            args.append("-f")

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def make_dir(
        self,
        path: Union[Union[str, Path], List[Union[str, Path]]],
        mode: Optional[int] = None,
    ) -> "TemplateBuilder":
        path_list = [path] if isinstance(path, (str, Path)) else path
        args = ["mkdir", "-p"]
        if mode:
            args.append(f"-m {pad_octal(mode)}")
        args.extend([str(p) for p in path_list])

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def make_symlink(
        self, src: Union[str, Path], dest: Union[str, Path]
    ) -> "TemplateBuilder":
        args = ["ln", "-s", str(src), str(dest)]
        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def run_cmd(
        self, command: Union[str, List[str]], user: Optional[str] = None
    ) -> "TemplateBuilder":
        commands = [command] if isinstance(command, str) else command
        args = [" && ".join(commands)]

        if user:
            args.append(user)

        instruction: Instruction = {
            "type": InstructionType.RUN,
            "args": args,
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def set_workdir(self, workdir: Union[str, Path]) -> "TemplateBuilder":
        instruction: Instruction = {
            "type": InstructionType.WORKDIR,
            "args": [str(workdir)],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def set_user(self, user: str) -> "TemplateBuilder":
        instruction: Instruction = {
            "type": InstructionType.USER,
            "args": [user],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def pip_install(
        self, packages: Optional[Union[str, List[str]]] = None
    ) -> "TemplateBuilder":
        if isinstance(packages, str):
            packages = [packages]

        args = ["pip", "install"]
        if packages:
            args.extend(packages)
        else:
            args.append(".")

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def npm_install(
        self,
        packages: Optional[Union[str, List[str]]] = None,
        g: Optional[bool] = False,
    ) -> "TemplateBuilder":
        if isinstance(packages, str):
            packages = [packages]

        args = ["npm", "install"]
        if g:
            args.append("-g")
        if packages:
            args.extend(packages)

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def apt_install(self, packages: Union[str, List[str]]) -> "TemplateBuilder":
        if isinstance(packages, str):
            packages = [packages]

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(
                [
                    "apt-get update",
                    f"DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y --no-install-recommends {' '.join(packages)}",
                ],
                user="root",
            )
        )

    def git_clone(
        self,
        url: str,
        path: Optional[Union[str, Path]] = None,
        branch: Optional[str] = None,
        depth: Optional[int] = None,
    ) -> "TemplateBuilder":
        args = ["git", "clone", url]
        if branch:
            args.append(f"--branch {branch}")
            args.append("--single-branch")
        if depth:
            args.append(f"--depth {depth}")
        if path:
            args.append(str(path))
        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args))
        )

    def set_envs(self, envs: Dict[str, str]) -> "TemplateBuilder":
        if len(envs) == 0:
            return self

        instruction: Instruction = {
            "type": InstructionType.ENV,
            "args": [item for key, value in envs.items() for item in [key, value]],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def skip_cache(self) -> "TemplateBuilder":
        self._template._force_next_layer = True
        return self

    def set_start_cmd(
        self, start_cmd: str, ready_cmd: Union[str, ReadyCmd]
    ) -> "TemplateFinal":
        self._template._start_cmd = start_cmd

        if isinstance(ready_cmd, ReadyCmd):
            ready_cmd = ready_cmd.get_cmd()

        self._template._ready_cmd = ready_cmd
        self._template._collect_stack_trace()
        return TemplateFinal(self._template)

    def set_ready_cmd(self, ready_cmd: Union[str, ReadyCmd]) -> "TemplateFinal":
        if isinstance(ready_cmd, ReadyCmd):
            ready_cmd = ready_cmd.get_cmd()

        self._template._ready_cmd = ready_cmd
        self._template._collect_stack_trace()
        return TemplateFinal(self._template)


class TemplateFinal:
    def __init__(self, template: "TemplateBase"):
        self._template = template


class TemplateBase:
    _limits = Limits(
        max_keepalive_connections=40,
        max_connections=40,
        keepalive_expiry=300,
    )
    _logs_refresh_frequency = 0.2

    def __init__(
        self,
        file_context_path: Optional[Union[str, Path]] = None,
        file_ignore_patterns: Optional[List[str]] = None,
    ):
        self._default_base_image: str = "e2bdev/base"
        self._base_image: Optional[str] = self._default_base_image
        self._base_template: Optional[str] = None
        self._registry_config: Optional[RegistryConfig] = None
        self._start_cmd: Optional[str] = None
        self._ready_cmd: Optional[str] = None
        # Force the whole template to be rebuilt
        self._force: bool = False
        # Force the next layer to be rebuilt
        self._force_next_layer: bool = False
        self._instructions: List[Instruction] = []
        # If no file_context_path is provided, use the caller's directory
        self._file_context_path = (
            file_context_path.as_posix()
            if isinstance(file_context_path, Path)
            else (file_context_path or get_caller_directory(STACK_TRACE_DEPTH) or ".")
        )
        self._file_ignore_patterns: List[str] = file_ignore_patterns or []
        self._stack_traces: List[Union[TracebackType, None]] = []
        self._stack_traces_enabled: bool = True

    def skip_cache(self) -> "TemplateBase":
        """Skip cache for the next instruction (before from instruction)"""
        self._force_next_layer = True
        return self

    def _collect_stack_trace(
        self, stack_traces_depth: int = STACK_TRACE_DEPTH
    ) -> "TemplateBase":
        """Collect stack trace if enabled"""
        if not self._stack_traces_enabled:
            return self

        stack = get_caller_frame(stack_traces_depth)
        if stack is None:
            self._stack_traces.append(None)
            return self

        # Create a traceback object from the caller frame
        capture_stack_trace = TracebackType(
            tb_next=None,
            tb_frame=stack,
            tb_lasti=stack.f_lasti,
            tb_lineno=stack.f_lineno,
        )

        self._stack_traces.append(capture_stack_trace)
        return self

    def _disable_stack_trace(self) -> "TemplateBase":
        """Disable stack trace collection"""
        self._stack_traces_enabled = False
        return self

    def _enable_stack_trace(self) -> "TemplateBase":
        """Enable stack trace collection"""
        self._stack_traces_enabled = True
        return self

    def _run_in_new_stack_trace_context(self, fn):
        """Run a function in a new stack trace context"""
        self._disable_stack_trace()
        result = fn()
        self._enable_stack_trace()
        self._collect_stack_trace(STACK_TRACE_DEPTH + 1)
        return result

    # Built-in image mixins
    def from_debian_image(self, variant: str = "slim") -> TemplateBuilder:
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"debian:{variant}")
        )

    def from_ubuntu_image(self, variant: str = "lts") -> TemplateBuilder:
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"ubuntu:{variant}")
        )

    def from_python_image(self, version: str = "3.13") -> TemplateBuilder:
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"python:{version}")
        )

    def from_node_image(self, variant: str = "lts") -> TemplateBuilder:
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"node:{variant}")
        )

    def from_base_image(self) -> TemplateBuilder:
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(self._default_base_image)
        )

    def from_image(
        self,
        image: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ) -> TemplateBuilder:
        """Private method to set base image without adding stack trace"""
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        if username and password:
            self._registry_config = {
                "type": "registry",
                "username": username,
                "password": password,
            }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_template(self, template: str) -> TemplateBuilder:
        self._base_template = template
        self._base_image = None

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_dockerfile(self, dockerfile_content_or_path: str) -> TemplateBuilder:
        """Parse a Dockerfile and convert it to Template SDK format

        Args:
            dockerfile_content_or_path: Either the Dockerfile content as a string,
                                       or a path to a Dockerfile file
        """
        # Create a TemplateBuilder first to use its methods
        builder = TemplateBuilder(self)

        # Parse the dockerfile using the builder as the interface
        base_image = parse_dockerfile(dockerfile_content_or_path, builder)
        self._base_image = base_image

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return builder

    def from_aws_registry(
        self,
        image: str,
        access_key_id: str,
        secret_access_key: str,
        region: str,
    ) -> TemplateBuilder:
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        self._registry_config = {
            "type": "aws",
            "awsAccessKeyId": access_key_id,
            "awsSecretAccessKey": secret_access_key,
            "awsRegion": region,
        }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_gcp_registry(
        self, image: str, service_account_json: Union[str, dict]
    ) -> TemplateBuilder:
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        self._registry_config = {
            "type": "gcp",
            "serviceAccountJson": read_gcp_service_account_json(
                self._file_context_path, service_account_json
            ),
        }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    @staticmethod
    def to_json(template: "TemplateClass") -> str:
        return json.dumps(
            template._template._serialize(
                template._template._instructions_with_hashes()
            ),
            indent=2,
        )

    @staticmethod
    def to_dockerfile(template: "TemplateClass") -> str:
        if template._template._base_template is not None:
            raise ValueError(
                "Cannot convert template built from another template to Dockerfile. "
                "Templates based on other templates can only be built using the E2B API."
            )

        if template._template._base_image is None:
            raise ValueError("No base image specified for template")

        dockerfile = f"FROM {template._template._base_image}\n"

        for instruction in template._template._instructions:
            dockerfile += (
                f"{instruction['type'].value} {' '.join(instruction['args'])}\n"
            )

        if template._template._start_cmd:
            dockerfile += f"ENTRYPOINT {template._template._start_cmd}\n"

        return dockerfile

    def _instructions_with_hashes(
        self,
    ) -> List[Instruction]:
        steps: List[Instruction] = []

        for index, instruction in enumerate(self._instructions):
            step: Instruction = {
                "type": instruction["type"],
                "args": instruction["args"],
                "force": instruction["force"],
                "forceUpload": instruction.get("forceUpload"),
                "resolveSymlinks": instruction.get("resolveSymlinks"),
            }

            if instruction["type"] == InstructionType.COPY:
                stack_trace = None
                if index + 1 < len(self._stack_traces):
                    stack_trace = self._stack_traces[index + 1]

                args = instruction.get("args", [])
                src = args[0] if len(args) > 0 else None
                dest = args[1] if len(args) > 1 else None
                if src is None or dest is None:
                    raise ValueError("Source path and destination path are required")

                step["filesHash"] = calculate_files_hash(
                    src,
                    dest,
                    self._file_context_path,
                    [
                        *self._file_ignore_patterns,
                        *read_dockerignore(self._file_context_path),
                    ],
                    instruction.get("resolveSymlinks", RESOLVE_SYMLINKS),
                    stack_trace,
                )

            steps.append(step)

        return steps

    def _serialize(self, steps: List[Instruction]) -> TemplateType:
        _steps: List[Instruction] = []

        for _, instruction in enumerate(steps):
            step: Instruction = {
                "type": instruction.get("type"),
                "args": instruction.get("args"),
                "force": instruction.get("force"),
            }

            if instruction.get("filesHash") is not None:
                step["filesHash"] = instruction["filesHash"]

            if instruction.get("forceUpload") is not None:
                step["forceUpload"] = instruction["forceUpload"]

            _steps.append(step)

        template_data: TemplateType = {
            "steps": _steps,
            "force": self._force,
        }

        if self._base_image is not None:
            template_data["fromImage"] = self._base_image

        if self._base_template is not None:
            template_data["fromTemplate"] = self._base_template

        if self._registry_config is not None:
            template_data["fromImageRegistry"] = self._registry_config

        if self._start_cmd is not None:
            template_data["startCmd"] = self._start_cmd

        if self._ready_cmd is not None:
            template_data["readyCmd"] = self._ready_cmd

        return template_data


TemplateClass = Union[TemplateFinal, TemplateBuilder]
