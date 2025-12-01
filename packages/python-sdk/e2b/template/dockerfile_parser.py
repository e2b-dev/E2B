import json
import os
import re
import tempfile
from typing import Dict, List, Optional, Protocol, Union, Literal

from dockerfile_parse import DockerfileParser
from e2b.template.types import CopyItem


class DockerfFileFinalParserInterface(Protocol):
    """Protocol defining the final interface for Dockerfile parsing callbacks."""


class DockerfileParserInterface(Protocol):
    """Protocol defining the interface for Dockerfile parsing callbacks."""

    def run_cmd(
        self, command: Union[str, List[str]], user: Optional[str] = None
    ) -> "DockerfileParserInterface":
        """Handle RUN instruction."""
        ...

    def copy(
        self,
        src: Union[str, List[CopyItem]],
        dest: Optional[str] = None,
        force_upload: Optional[Literal[True]] = None,
        resolve_symlinks: Optional[bool] = None,
        user: Optional[str] = None,
        mode: Optional[int] = None,
    ) -> "DockerfileParserInterface":
        """Handle COPY instruction."""
        ...

    def set_workdir(self, workdir: str) -> "DockerfileParserInterface":
        """Handle WORKDIR instruction."""
        ...

    def set_user(self, user: str) -> "DockerfileParserInterface":
        """Handle USER instruction."""
        ...

    def set_envs(self, envs: Dict[str, str]) -> "DockerfileParserInterface":
        """Handle ENV instruction."""
        ...

    def set_start_cmd(
        self, start_cmd: str, ready_cmd: str
    ) -> "DockerfFileFinalParserInterface":
        """Handle CMD/ENTRYPOINT instruction."""
        ...


def parse_dockerfile(
    dockerfile_content_or_path: str, template_builder: DockerfileParserInterface
) -> str:
    """
    Parse a Dockerfile and convert it to Template SDK format.

    :param dockerfile_content_or_path: Either the Dockerfile content as a string, or a path to a Dockerfile file
    :param template_builder: Interface providing template builder methods

    :return: The base image from the Dockerfile

    :raises ValueError: If the Dockerfile is invalid or unsupported
    """
    # Check if input is a file path that exists
    if os.path.isfile(dockerfile_content_or_path):
        # Read the file content
        with open(dockerfile_content_or_path, "r", encoding="utf-8") as f:
            dockerfile_content = f.read()
    else:
        # Treat as content directly
        dockerfile_content = dockerfile_content_or_path

    # Use a temporary directory to avoid creating files in the current directory
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a temporary Dockerfile
        dockerfile_path = os.path.join(temp_dir, "Dockerfile")
        with open(dockerfile_path, "w") as f:
            f.write(dockerfile_content)

        dfp = DockerfileParser(path=temp_dir)

        # Check for multi-stage builds
        from_instructions = [
            instruction
            for instruction in dfp.structure
            if instruction["instruction"] == "FROM"
        ]

        if len(from_instructions) > 1:
            raise ValueError("Multi-stage Dockerfiles are not supported")

        if len(from_instructions) == 0:
            raise ValueError("Dockerfile must contain a FROM instruction")

        # Set the base image from the first FROM instruction
        base_image = from_instructions[0]["value"]
        # Remove AS alias if present (e.g., "node:18 AS builder" -> "node:18")
        if " as " in base_image.lower():
            base_image = base_image.split(" as ")[0].strip()

        user_changed = False
        workdir_changed = False

        # Set the user and workdir to the Docker defaults
        template_builder.set_user("root")
        template_builder.set_workdir("/")

        # Process all other instructions
        for instruction_data in dfp.structure:
            instruction = instruction_data["instruction"]
            value = instruction_data["value"]

            if instruction == "FROM":
                # Already handled above
                continue
            elif instruction == "RUN":
                _handle_run_instruction(value, template_builder)
            elif instruction in ["COPY", "ADD"]:
                _handle_copy_instruction(value, template_builder)
            elif instruction == "WORKDIR":
                _handle_workdir_instruction(value, template_builder)
                workdir_changed = True
            elif instruction == "USER":
                _handle_user_instruction(value, template_builder)
                user_changed = True
            elif instruction in ["ENV", "ARG"]:
                _handle_env_instruction(value, instruction, template_builder)
            elif instruction in ["CMD", "ENTRYPOINT"]:
                _handle_cmd_entrypoint_instruction(value, template_builder)
            else:
                print(f"Unsupported instruction: {instruction}")
                continue

    # Set the user and workdir to the E2B defaults
    if not user_changed:
        template_builder.set_user("user")
    if not workdir_changed:
        template_builder.set_workdir("/home/user")

    return base_image


def _handle_run_instruction(
    value: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle RUN instruction"""
    if not value.strip():
        return
    # Remove line continuations and normalize whitespace
    command = re.sub(r"\\\s*\n\s*", " ", value).strip()
    template_builder.run_cmd(command)


def _handle_copy_instruction(
    value: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle COPY/ADD instruction"""
    if not value.strip():
        return
    # Parse source and destination from COPY/ADD command
    # Handle both quoted and unquoted paths
    parts = []
    current_part = ""
    in_quotes = False
    quote_char = None

    i = 0
    while i < len(value):
        char = value[i]
        if char in ['"', "'"] and (i == 0 or value[i - 1] != "\\"):
            if not in_quotes:
                in_quotes = True
                quote_char = char
            elif char == quote_char:
                in_quotes = False
                quote_char = None
            else:
                current_part += char
        elif char == " " and not in_quotes:
            if current_part:
                parts.append(current_part)
                current_part = ""
        else:
            current_part += char
        i += 1

    if current_part:
        parts.append(current_part)

    if len(parts) >= 2:
        src = parts[0]
        dest = parts[-1]  # Last part is destination
        template_builder.copy(src, dest)


def _handle_workdir_instruction(
    value: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle WORKDIR instruction"""
    if not value.strip():
        return
    workdir = value.strip()
    template_builder.set_workdir(workdir)


def _handle_user_instruction(
    value: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle USER instruction"""
    if not value.strip():
        return
    user = value.strip()
    template_builder.set_user(user)


def _handle_env_instruction(
    value: str, instruction_type: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle ENV/ARG instruction"""
    if not value.strip():
        return

    # Parse environment variables from the value
    # Handle both "KEY=value" and "KEY value" formats
    env_vars = {}

    # First try to split on = for KEY=value format
    if "=" in value:
        # Handle multiple KEY=value pairs on one line
        pairs = re.findall(r"(\w+)=([^\s]*(?:\s+(?!\w+=)[^\s]*)*)", value)
        for key, val in pairs:
            env_vars[key] = val.strip("\"'")
    else:
        # Handle "KEY value" format
        parts = value.split(None, 1)
        if len(parts) == 2:
            key, val = parts
            env_vars[key] = val.strip("\"'")
        elif len(parts) == 1 and instruction_type == "ARG":
            # ARG without default value
            key = parts[0]
            env_vars[key] = ""

    # Add each environment variable
    if env_vars:
        template_builder.set_envs(env_vars)


def _handle_cmd_entrypoint_instruction(
    value: str, template_builder: DockerfileParserInterface
) -> None:
    """Handle CMD/ENTRYPOINT instruction - convert to set_start_cmd with 20s timeout"""
    if not value.strip():
        return
    command = value.strip()

    # Try to parse as JSON (for array format like CMD ["sleep", "infinity"])
    try:
        parsed_command = json.loads(command)
        if isinstance(parsed_command, list):
            command = " ".join(str(item) for item in parsed_command)
    except Exception:
        pass

    # Import wait_for_timeout locally to avoid circular dependency
    def wait_for_timeout(timeout: int) -> str:
        # convert to seconds, but ensure minimum of 1 second
        seconds = max(1, timeout // 1000)
        return f"sleep {seconds}"

    template_builder.set_start_cmd(command, wait_for_timeout(20_000))
