import os
import re
import shlex
from typing import Dict, List, Literal, Mapping, Optional, Protocol, Union

from e2b_dockerfile_utils import (
    DockerfileHeredoc,
    DockerfileInstruction,
    DockerfileSyntaxError,
    ShellLex,
    chomp_heredoc_content,
    parse_dockerfile_ast,
    parse_heredoc,
)
from e2b.template.readycmd import wait_for_timeout

__all__ = [
    "DockerfileParserInterface",
    "DockerfFileFinalParserInterface",
    "DockerfileSyntaxError",
    "parse_dockerfile",
]


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
        src: str,
        dest: str,
        force_upload: Optional[Literal[True]] = None,
        user: Optional[str] = None,
        mode: Optional[int] = None,
        resolve_symlinks: Optional[bool] = None,
        gzip: Optional[bool] = None,
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


# flag name -> (type, ignored). Ignored flags are accepted with a warning.
FlagSpecs = Mapping[str, "tuple[str, bool]"]

_RUN_FLAGS: FlagSpecs = {
    "mount": ("string", True),
    "network": ("string", True),
    "security": ("string", True),
    "device": ("string", True),
}

_COPY_FLAGS: FlagSpecs = {
    "chown": ("string", False),
    "chmod": ("string", False),
    "from": ("string", False),
    "link": ("bool", True),
    "exclude": ("string", True),
    "parents": ("bool", True),
}

_ADD_FLAGS: FlagSpecs = {
    **_COPY_FLAGS,
    "keep-git-dir": ("bool", True),
    "checksum": ("string", True),
    "unpack": ("bool", True),
}

_FROM_FLAGS: FlagSpecs = {
    "platform": ("string", True),
}

# Metadata-only instructions that have no equivalent in a template.
_IGNORED_INSTRUCTIONS = {"EXPOSE", "VOLUME", "LABEL", "MAINTAINER"}

_CHMOD = re.compile(r"^[0-7]{3,4}$")
_REMOTE_URL = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)


def _shell_join(words: List[str]) -> str:
    return " ".join(shlex.quote(word) for word in words)


_VARIABLE_NAME = re.compile(r"\d+|[@*#?\-$!0]|\w+")


def _shell_literal(ch: str, stop_char: Optional[str] = None) -> str:
    return "\\" + ch if ch in "\\`$" or ch == stop_char else ch


def _expandable_heredoc_body(content: str, line: int) -> str:
    """Rewrite an expandable heredoc body so that the shell applies Docker's
    rules: ``$VAR`` / ``${VAR...}`` are substituted, a backslash escapes the next
    character, and everything else - ``$(...)`` and backticks included - is literal.
    Backslashes inside ``#``, ``%`` and ``/`` patterns stay significant to the
    shell's pattern matching, as they do for Docker.
    """
    pos = 0

    def missing(stop_char: str) -> DockerfileSyntaxError:
        what = "'/' in ${}" if stop_char == "/" else "'}'"
        return DockerfileSyntaxError(f"syntax error: missing {what}", line)

    def name() -> str:
        nonlocal pos
        match = _VARIABLE_NAME.match(content, pos)
        if match is None:
            return ""
        pos = match.end()
        return match.group(0)

    def variable() -> str:
        nonlocal pos
        if pos >= len(content) or content[pos] != "{":
            var_name = name()
            return "\\$" if var_name == "" else "$" + var_name
        pos += 1
        if pos >= len(content):
            raise missing("}")
        if content[pos] in "{}:":
            raise DockerfileSyntaxError("syntax error: bad substitution", line)
        var_name = name()
        if pos >= len(content):
            raise missing("}")
        modifier = content[pos]
        pos += 1
        if modifier == "}":
            return "${" + var_name + "}"
        if modifier == "/":
            if pos < len(content) and content[pos] == "/":
                modifier += "/"
                pos += 1
            pattern = scan("/", True)
            return "${" + var_name + modifier + pattern + "/" + scan("}", True) + "}"
        if modifier == ":":
            if pos >= len(content):
                raise missing("}")
            modifier += content[pos]
            pos += 1
        op = modifier[-1]
        is_pattern = op in "#%"
        if op not in "+-?#%" or (len(modifier) == 2 and is_pattern):
            raise DockerfileSyntaxError(
                f"unsupported modifier ({modifier}) in substitution", line
            )
        return "${" + var_name + modifier + scan("}", is_pattern) + "}"

    def scan(stop_char: Optional[str], raw_escapes: bool = False) -> str:
        nonlocal pos
        out: List[str] = []
        while pos < len(content):
            ch = content[pos]
            pos += 1
            if ch == stop_char:
                return "".join(out)
            if ch == "\\":
                if pos < len(content):
                    nxt = content[pos]
                    pos += 1
                    out.append(
                        "\\" + nxt if raw_escapes else _shell_literal(nxt, stop_char)
                    )
            elif ch == "$":
                out.append(variable())
            elif ch == "`":
                out.append("\\`")
            else:
                out.append(ch)
        if stop_char is not None:
            raise missing(stop_char)
        return "".join(out)

    return scan(None)


def _heredoc_terminator(name: str, content: str) -> str:
    """A heredoc delimiter that does not occur in the content it wraps."""
    terminator = "E2B_HEREDOC_" + re.sub(r"[^A-Za-z0-9_]", "_", name)
    while terminator in content:
        terminator += "_"
    return terminator


def _with_trailing_newline(content: str) -> str:
    if content == "" or content.endswith("\n"):
        return content
    return content + "\n"


class _StartCommand:
    def __init__(self, json: bool, args: List[str]) -> None:
        self.json = json
        self.args = args


class _DockerfileConverter:
    def __init__(
        self, template_builder: DockerfileParserInterface, escape_token: str
    ) -> None:
        self._template_builder = template_builder
        self._lex = ShellLex(escape_token)
        self._vars: Dict[str, str] = {}
        # Expands the ARG / ENV values declared earlier in the Dockerfile.
        self._env_lex = ShellLex(escape_token, env=self._vars, skip_unset_env=False)
        self._user_changed = False
        self._workdir_changed = False
        self._cmd: Optional[_StartCommand] = None
        self._entrypoint: Optional[_StartCommand] = None

    def convert(self, instructions: List[DockerfileInstruction]) -> str:
        from_instructions = [i for i in instructions if i.name == "FROM"]
        if len(from_instructions) > 1:
            raise DockerfileSyntaxError("Multi-stage Dockerfiles are not supported")
        if not from_instructions:
            raise DockerfileSyntaxError("Dockerfile must contain a FROM instruction")

        from_instruction = from_instructions[0]
        base_image = self._handle_from(from_instruction)

        # Set the user and workdir to the Docker defaults
        self._template_builder.set_user("root")
        self._template_builder.set_workdir("/")

        for instruction in instructions:
            if instruction.name == "FROM":
                continue
            if (
                instruction.start_line < from_instruction.start_line
                and instruction.name != "ARG"
            ):
                raise DockerfileSyntaxError(
                    f"{instruction.name} must be preceded by a FROM instruction",
                    instruction.start_line,
                )
            self._handle_instruction(instruction)

        self._apply_start_cmd()

        # Set the user and workdir to the E2B defaults
        if not self._user_changed:
            self._template_builder.set_user("user")
        if not self._workdir_changed:
            self._template_builder.set_workdir("/home/user")

        return base_image

    def _handle_instruction(self, instruction: DockerfileInstruction) -> None:
        name = instruction.name
        if name == "RUN":
            self._handle_run(instruction)
        elif name == "COPY":
            self._handle_copy(instruction, _COPY_FLAGS)
        elif name == "ADD":
            self._handle_copy(instruction, _ADD_FLAGS)
        elif name == "WORKDIR":
            self._template_builder.set_workdir(self._expand_single(instruction))
            self._workdir_changed = True
        elif name == "USER":
            self._template_builder.set_user(self._expand_single(instruction))
            self._user_changed = True
        elif name == "ENV":
            self._handle_env(instruction)
        elif name == "ARG":
            self._handle_arg(instruction)
        elif name == "CMD":
            self._parse_flags(instruction, {})
            self._cmd = _StartCommand(instruction.json, instruction.args)
        elif name == "ENTRYPOINT":
            self._parse_flags(instruction, {})
            self._entrypoint = _StartCommand(instruction.json, instruction.args)
        elif name not in _IGNORED_INSTRUCTIONS:
            print(f"Unsupported instruction: {name}")

    def _expand(
        self,
        instruction: DockerfileInstruction,
        word: str,
        lex: Optional[ShellLex] = None,
    ) -> str:
        """Resolve quotes and escapes in a word, keeping ``$VAR`` references."""
        try:
            return (lex or self._lex).process_word(word)
        except ValueError as err:
            raise DockerfileSyntaxError(str(err), instruction.start_line) from None

    def _expand_single(self, instruction: DockerfileInstruction) -> str:
        self._parse_flags(instruction, {})
        if len(instruction.args) != 1:
            raise DockerfileSyntaxError(
                f"{instruction.name} requires exactly one argument",
                instruction.start_line,
            )
        return self._expand(instruction, instruction.args[0])

    def _parse_flags(
        self, instruction: DockerfileInstruction, specs: FlagSpecs
    ) -> Dict[str, str]:
        values: Dict[str, str] = {}
        for flag in instruction.flags:
            if not flag.startswith("--"):
                raise DockerfileSyntaxError(
                    f"arg should start with -- : {flag}", instruction.start_line
                )
            body = flag[2:]
            name, sep, raw_value = body.partition("=")
            has_value = sep == "="

            spec = specs.get(name)
            if spec is None:
                raise DockerfileSyntaxError(
                    f"unknown flag: {name}", instruction.start_line
                )
            if name in values:
                raise DockerfileSyntaxError(
                    f"duplicate flag specified: {name}", instruction.start_line
                )

            flag_type, ignored = spec
            if flag_type == "bool":
                if not has_value or raw_value in ("", "true"):
                    value = "true"
                elif raw_value == "false":
                    value = "false"
                else:
                    raise DockerfileSyntaxError(
                        f"expecting boolean value for flag {name}, not: {raw_value}",
                        instruction.start_line,
                    )
            else:
                if not has_value:
                    raise DockerfileSyntaxError(
                        f"missing a value on flag: {name}", instruction.start_line
                    )
                value = raw_value

            if ignored:
                print(
                    f"Ignoring unsupported {instruction.name} flag --{name} "
                    f"(line {instruction.start_line})"
                )
                continue
            values[name] = value
        return values

    def _handle_from(self, instruction: DockerfileInstruction) -> str:
        self._parse_flags(instruction, _FROM_FLAGS)
        args = instruction.args
        if len(args) == 3 and args[1].lower() == "as":
            pass  # stage alias is irrelevant for a single-stage build
        elif len(args) != 1:
            raise DockerfileSyntaxError(
                "FROM requires either one or three arguments",
                instruction.start_line,
            )
        return self._expand(instruction, args[0])

    def _handle_run(self, instruction: DockerfileInstruction) -> None:
        self._parse_flags(instruction, _RUN_FLAGS)
        args = instruction.args
        if not args:
            raise DockerfileSyntaxError(
                "RUN requires at least one argument", instruction.start_line
            )

        if instruction.json:
            command = _shell_join(args)
        elif instruction.heredocs:
            command = self._run_with_heredocs(args[0], instruction.heredocs)
        else:
            command = args[0]
        self._template_builder.run_cmd(command)

    @staticmethod
    def _run_with_heredocs(line: str, heredocs: List[DockerfileHeredoc]) -> str:
        def heredoc_content(heredoc: DockerfileHeredoc) -> str:
            if heredoc.chomp:
                return chomp_heredoc_content(heredoc.content)
            return heredoc.content

        # `RUN <<EOF` on its own: the heredoc body is the script itself.
        if len(heredocs) == 1 and parse_heredoc(line.strip()) is not None:
            heredoc = heredocs[0]
            content = heredoc_content(heredoc)
            if not content.startswith("#!"):
                return content
            # A shebang script: write it to a temporary file and execute it.
            script = shlex.quote(f"/tmp/{heredoc.name}")
            terminator = _heredoc_terminator(heredoc.name, content)
            return (
                f"cat <<'{terminator}' >{script}\n"
                + _with_trailing_newline(content)
                + f"{terminator}\n"
                + f"chmod +x {script} && {script}\n"
                + f"E2B_EXIT=$?; rm -f {script}; exit $E2B_EXIT"
            )

        # Heredocs used as part of a larger command (`cat <<EOF > file`,
        # `python3 <<EOF`): rebuild the heredoc so the shell handles it.
        full = line
        for heredoc in heredocs:
            full += "\n" + heredoc.content + heredoc.name
        return full

    def _handle_copy(
        self, instruction: DockerfileInstruction, specs: FlagSpecs
    ) -> None:
        flags = self._parse_flags(instruction, specs)
        if len(instruction.args) < 2:
            raise DockerfileSyntaxError(
                f"{instruction.name} requires at least two arguments",
                instruction.start_line,
            )
        if "from" in flags:
            raise DockerfileSyntaxError(
                f"{instruction.name} --from is not supported "
                "(multi-stage builds are not supported)",
                instruction.start_line,
            )

        user = self._expand(instruction, flags["chown"]) if "chown" in flags else None
        mode: Optional[int] = None
        if "chmod" in flags:
            chmod = self._expand(instruction, flags["chmod"])
            resolved = self._expand(instruction, flags["chmod"], self._env_lex)
            if not _CHMOD.match(resolved):
                detail = "" if resolved == chmod else f' (resolves to "{resolved}")'
                raise DockerfileSyntaxError(
                    f'invalid chmod value "{chmod}"{detail}, '
                    "expected an octal mode such as 0755",
                    instruction.start_line,
                )
            mode = int(resolved, 8)

        # Heredoc markers are recognized on the raw tokens, like the AST does:
        # a quoted `"<<EOF"` is a literal file name, not a heredoc.
        raw_dest = instruction.args[-1]
        if parse_heredoc(raw_dest) is not None:
            raise DockerfileSyntaxError(
                f"{instruction.name} cannot accept a heredoc as a destination",
                instruction.start_line,
            )
        dest = self._expand(instruction, raw_dest)

        heredocs_by_name = {heredoc.name: heredoc for heredoc in instruction.heredocs}

        for raw_src in instruction.args[:-1]:
            heredoc = parse_heredoc(raw_src)
            if heredoc is not None:
                content = heredocs_by_name.get(heredoc.name)
                if content is None:
                    raise DockerfileSyntaxError(
                        f"missing heredoc content for {heredoc.name}",
                        instruction.start_line,
                    )
                self._copy_heredoc(content, dest, user, mode, instruction.start_line)
                continue
            src = self._expand(instruction, raw_src)
            if instruction.name == "ADD" and _REMOTE_URL.match(src):
                raise DockerfileSyntaxError(
                    f"ADD from a remote URL is not supported: {src}",
                    instruction.start_line,
                )
            self._template_builder.copy(src, dest, user=user, mode=mode)

    def _copy_heredoc(
        self,
        heredoc: DockerfileHeredoc,
        dest: str,
        user: Optional[str],
        mode: Optional[int],
        line: int,
    ) -> None:
        """``COPY <<EOF /path`` writes the heredoc body to a file inside the sandbox."""
        content = (
            chomp_heredoc_content(heredoc.content) if heredoc.chomp else heredoc.content
        )
        if heredoc.expand:
            content = _expandable_heredoc_body(content, line)
        plain_terminator = _heredoc_terminator(heredoc.name, content)
        terminator = plain_terminator if heredoc.expand else f"'{plain_terminator}'"
        target = '"$E2B_HEREDOC_DEST"'

        # Like Docker, a dest that is a directory receives a file named after the heredoc.
        if dest.endswith("/"):
            command = f"E2B_HEREDOC_DEST={shlex.quote(dest + heredoc.name)}\n"
        else:
            command = (
                f"E2B_HEREDOC_DEST={shlex.quote(dest)}\n"
                f"if [ -d {target} ]; then E2B_HEREDOC_DEST={target}/{shlex.quote(heredoc.name)}; fi\n"
            )
        command += (
            f'mkdir -p "$(dirname {target})" && cat <<{terminator} >{target}\n'
            + _with_trailing_newline(content)
            + plain_terminator
        )
        if user is not None:
            command += f"\nchown {shlex.quote(user)} {target}"
        if mode is not None:
            command += f"\nchmod {mode:o} {target}"
        # COPY writes as the builder (root), independent of the current USER.
        self._template_builder.run_cmd(command, user="root")

    def _handle_env(self, instruction: DockerfileInstruction) -> None:
        self._parse_flags(instruction, {})
        args = instruction.args
        if not args:
            raise DockerfileSyntaxError(
                "ENV requires at least one argument", instruction.start_line
            )
        envs: Dict[str, str] = {}
        for i in range(0, len(args) - 2, 3):
            key = self._expand(instruction, args[i])
            if key == "":
                raise DockerfileSyntaxError(
                    "ENV names can not be blank", instruction.start_line
                )
            envs[key] = self._expand(instruction, args[i + 1])
            self._vars[key] = self._expand(instruction, args[i + 1], self._env_lex)
        self._template_builder.set_envs(envs)

    def _handle_arg(self, instruction: DockerfileInstruction) -> None:
        self._parse_flags(instruction, {})
        args = instruction.args
        if not args:
            raise DockerfileSyntaxError(
                "ARG requires at least one argument", instruction.start_line
            )
        envs: Dict[str, str] = {}
        for arg in args:
            name, sep, value = arg.partition("=")
            key = self._expand(instruction, name)
            if key == "":
                raise DockerfileSyntaxError(
                    "ARG names can not be blank", instruction.start_line
                )
            envs[key] = self._expand(instruction, value) if sep else ""
            self._vars[key] = (
                self._expand(instruction, value, self._env_lex) if sep else ""
            )
        self._template_builder.set_envs(envs)

    def _apply_start_cmd(self) -> None:
        """
        Combine ENTRYPOINT and CMD following Docker's rules:
        - exec-form ENTRYPOINT gets CMD appended as arguments
          (a shell-form CMD is appended as ``/bin/sh -c <cmd>``),
        - shell-form ENTRYPOINT ignores CMD,
        - without ENTRYPOINT the CMD is used as-is.
        """
        cmd = self._cmd
        entrypoint = self._entrypoint
        command: Optional[str] = None

        if entrypoint is not None:
            if entrypoint.json:
                words = list(entrypoint.args)
                if cmd is not None:
                    if cmd.json:
                        words.extend(cmd.args)
                    elif cmd.args:
                        words.extend(["/bin/sh", "-c", cmd.args[0]])
                command = _shell_join(words) if words else None
            else:
                command = entrypoint.args[0] if entrypoint.args else None
        elif cmd is not None:
            if cmd.json:
                command = _shell_join(cmd.args) if cmd.args else None
            else:
                command = cmd.args[0] if cmd.args else None

        if command is not None and command.strip() != "":
            self._template_builder.set_start_cmd(command, wait_for_timeout(20_000))


def _read_dockerfile(dockerfile_content_or_path: str) -> str:
    try:
        if os.path.isfile(dockerfile_content_or_path):
            with open(dockerfile_content_or_path, "r", encoding="utf-8") as f:
                return f.read()
    except (OSError, ValueError):
        # If there's any error checking the file, treat as content
        pass
    return dockerfile_content_or_path


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
    dockerfile_content = _read_dockerfile(dockerfile_content_or_path)
    ast = parse_dockerfile_ast(dockerfile_content)

    for warning in ast.warnings:
        print(f"{warning.message} (line {warning.line})")

    return _DockerfileConverter(template_builder, ast.escape_token).convert(
        ast.instructions
    )
