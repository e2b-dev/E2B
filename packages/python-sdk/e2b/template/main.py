import json
from typing import Dict, List, Optional, Union
from httpx import Limits

from e2b.template.dockerfile_parser import parse_dockerfile
from e2b.template.types import CopyItem, Duration, Instruction, Step, TemplateType
from e2b.template.utils import (
    calculate_files_hash,
    get_caller_directory,
    pad_octal,
    read_dockerignore,
)


class TemplateBuilder:
    """Builder stage after fromImage - all methods except start/ready commands available"""

    def __init__(self, template: "TemplateBase"):
        self._template = template

    def copy(
        self,
        src: Union[str, List[CopyItem]],
        dest: Optional[str] = None,
        force_upload: Optional[bool] = None,
        user: Optional[str] = None,
        mode: Optional[int] = None,
    ) -> "TemplateBuilder":
        if isinstance(src, str):
            # Single copy operation
            if dest is None:
                raise ValueError("dest parameter is required when src is a string")
            copy_items: List[CopyItem] = [
                {
                    "src": src,
                    "dest": dest,
                    "forceUpload": force_upload,
                    "user": user,
                    "mode": mode,
                }
            ]
        else:
            # Multiple copy operations
            copy_items = src

        for copy_item in copy_items:
            args = [
                copy_item["src"],
                copy_item["dest"],
                user or "",
                pad_octal(mode) if mode else "",
            ]

            instruction: Instruction = Instruction(
                type="COPY",
                args=args,
                force=force_upload or self._template._force_next_layer,
                forceUpload=force_upload,
            )
            self._template._instructions.append(instruction)
        return self

    def remove(
        self, path: str, force: bool = False, recursive: bool = False
    ) -> "TemplateBuilder":
        args = ["rm", path]
        if recursive:
            args.append("-r")
        if force:
            args.append("-f")

        self.run_cmd(" ".join(args))
        return self

    def rename(self, src: str, dest: str, force: bool = False) -> "TemplateBuilder":
        args = ["mv", src, dest]
        if force:
            args.append("-f")

        self.run_cmd(" ".join(args))
        return self

    def make_dir(
        self, paths: Union[str, List[str]], mode: Optional[int] = None
    ) -> "TemplateBuilder":
        if isinstance(paths, str):
            paths = [paths]

        args = ["mkdir", "-p", *paths]
        if mode:
            args.append(f"-m {pad_octal(mode)}")

        self.run_cmd(" ".join(args))
        return self

    def make_symlink(self, src: str, dest: str) -> "TemplateBuilder":
        args = ["ln", "-s", src, dest]
        self.run_cmd(" ".join(args))
        return self

    def run_cmd(
        self, command: Union[str, List[str]], user: Optional[str] = None
    ) -> "TemplateBuilder":
        commands = [command] if isinstance(command, str) else command
        args = [" && ".join(commands)]

        if user:
            args.append(user)

        instruction: Instruction = Instruction(
            type="RUN",
            args=args,
            force=self._template._force_next_layer,
            forceUpload=None,
        )
        self._template._instructions.append(instruction)
        return self

    def set_workdir(self, workdir: str) -> "TemplateBuilder":
        instruction: Instruction = Instruction(
            type="WORKDIR",
            args=[workdir],
            force=self._template._force_next_layer,
            forceUpload=None,
        )
        self._template._instructions.append(instruction)
        return self

    def set_user(self, user: str) -> "TemplateBuilder":
        instruction: Instruction = Instruction(
            type="USER",
            args=[user],
            force=self._template._force_next_layer,
            forceUpload=None,
        )
        self._template._instructions.append(instruction)
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

        return self.run_cmd(" ".join(args))

    def npm_install(
        self,
        packages: Optional[Union[str, List[str]]] = None,
        g: Optional[bool] = False,
    ) -> "TemplateBuilder":
        if isinstance(packages, str):
            packages = [packages]

        args = ["npm", "install"]
        if packages:
            args.extend(packages)
        if g:
            args.append("-g")

        return self.run_cmd(" ".join(args))

    def apt_install(self, packages: Union[str, List[str]]) -> "TemplateBuilder":
        if isinstance(packages, str):
            packages = [packages]

        return self.run_cmd(
            [
                "apt-get update",
                f"DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y --no-install-recommends {' '.join(packages)}",
            ],
            user="root",
        )

    def git_clone(
        self,
        url: str,
        path: Optional[str] = None,
        branch: Optional[str] = None,
        depth: Optional[int] = None,
    ) -> "TemplateBuilder":
        args = ["git", "clone", url, path]
        if branch:
            args.append(f"--branch {branch}")
            args.append("--single-branch")
        if depth:
            args.append(f"--depth {depth}")
        return self.run_cmd(" ".join(args))

    def set_envs(self, envs: Dict[str, str]) -> "TemplateBuilder":
        if len(envs) == 0:
            return self

        instruction: Instruction = Instruction(
            type="ENV",
            args=[item for key, value in envs.items() for item in [key, value]],
            force=self._template._force_next_layer,
            forceUpload=None,
        )
        self._template._instructions.append(instruction)
        return self

    def skip_cache(self) -> "TemplateBuilder":
        self._template._force_next_layer = True
        return self

    def set_start_cmd(self, start_cmd: str, ready_cmd: str) -> "TemplateFinal":
        self._template._start_cmd = start_cmd
        self._template._ready_cmd = ready_cmd
        return TemplateFinal(self._template)

    def set_ready_cmd(self, ready_cmd: str) -> "TemplateFinal":
        self._template._ready_cmd = ready_cmd
        return TemplateFinal(self._template)


class TemplateFinal:
    """Final stage - only start/ready commands and utility methods available"""

    def __init__(self, template: "TemplateBase"):
        self._template = template


class TemplateBase:
    _limits = Limits(
        max_keepalive_connections=40,
        max_connections=40,
        keepalive_expiry=300,
    )
    _logs_refresh_frequency = 0.2
    _default_base_image: str = "e2bdev/base"
    _base_image: Optional[str] = _default_base_image
    _base_template: Optional[str] = None
    _start_cmd: Optional[str] = None
    _ready_cmd: Optional[str] = None
    # Force the whole template to be rebuilt
    _force: bool = False
    # Force the next layer to be rebuilt
    _force_next_layer: bool = False
    _instructions: List[Instruction] = []

    def __init__(
        self,
        file_context_path: Optional[str] = None,
        ignore_file_paths: List[str] = [],
    ):
        # If no file_context_path is provided, use the caller's directory
        self._file_context_path: str = (
            file_context_path or get_caller_directory() or "."
        )
        self._ignore_file_paths: List[str] = ignore_file_paths

    def skip_cache(self) -> "TemplateBase":
        """Skip cache for the next instruction (before from instruction)"""
        self._force_next_layer = True
        return self

    # Built-in image mixins
    def from_debian_image(self, variant: str = "slim") -> TemplateBuilder:
        return self.from_image(f"debian:{variant}")

    def from_ubuntu_image(self, variant: str = "lts") -> TemplateBuilder:
        return self.from_image(f"ubuntu:{variant}")

    def from_python_image(self, version: str = "3.13") -> TemplateBuilder:
        return self.from_image(f"python:{version}")

    def from_node_image(self, variant: str = "lts") -> TemplateBuilder:
        return self.from_image(f"node:{variant}")

    def from_base_image(self) -> TemplateBuilder:
        return self.from_image(self._default_base_image)

    def from_image(self, base_image: str) -> TemplateBuilder:
        self._base_image = base_image
        self._base_template = None

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        return TemplateBuilder(self)

    def from_template(self, template: str) -> TemplateBuilder:
        self._base_template = template
        self._base_image = None

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

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

        return builder

    @staticmethod
    def to_json(template: "TemplateBase") -> str:
        return template.__to_json()

    def __to_json(self) -> str:
        return json.dumps(
            self._serialize(self._calculate_hashes()),
            indent=2,
        )

    @staticmethod
    def to_dockerfile(template: "TemplateBase") -> str:
        return template.__to_dockerfile()

    def __to_dockerfile(self) -> str:
        if self._base_template is not None:
            raise ValueError(
                "Cannot convert template built from another template to Dockerfile. "
                "Templates based on other templates can only be built using the E2B API."
            )

        if self._base_image is None:
            raise ValueError("No base image specified for template")

        dockerfile = f"FROM {self._base_image}\n"

        for instruction in self._instructions:
            dockerfile += f"{instruction['type']} {' '.join(instruction['args'])}\n"

        if self._start_cmd:
            dockerfile += f"ENTRYPOINT {self._start_cmd}\n"

        return dockerfile

    def _calculate_hashes(
        self,
    ) -> List[Step]:
        steps: List[Step] = []

        for instruction in self._instructions:
            step: Step = Step(
                type=instruction["type"],
                args=instruction["args"],
                force=instruction["force"],
                forceUpload=instruction.get("forceUpload"),
            )

            if instruction["type"] == "COPY":
                step["filesHash"] = calculate_files_hash(
                    instruction["args"][0],
                    instruction["args"][1],
                    self._file_context_path,
                    [
                        *self._ignore_file_paths,
                        *read_dockerignore(self._file_context_path),
                    ],
                )

            steps.append(step)

        return steps

    def _serialize(self, steps: List[Step]) -> TemplateType:
        template_data: TemplateType = {
            "steps": steps,
            "force": self._force,
        }

        if self._base_image is not None:
            template_data["fromImage"] = self._base_image

        if self._base_template is not None:
            template_data["fromTemplate"] = self._base_template

        if self._start_cmd is not None:
            template_data["startCmd"] = self._start_cmd

        if self._ready_cmd is not None:
            template_data["readyCmd"] = self._ready_cmd

        return template_data

    @classmethod
    def wait_for_port(cls, port: int) -> str:
        """Generate a command to wait for a port to be available."""
        return f"ss -tuln | grep :{port}"

    @classmethod
    def wait_for_url(cls, url: str, status_code: int = 200) -> str:
        """Generate a command to wait for a URL to return a specific status code."""
        return (
            f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
        )

    @classmethod
    def wait_for_process(cls, process_name: str) -> str:
        """Generate a command to wait for a process to be running."""
        return f"pgrep {process_name} > /dev/null"

    @classmethod
    def wait_for_file(cls, filename: str) -> str:
        """Generate a command to wait for a file to exist."""
        return f"[ -f {filename} ]"

    @classmethod
    def wait_for_timeout(cls, timeout: Duration) -> str:
        """Generate a command to wait for a specified duration."""
        return f"sleep {timeout}"
