import hashlib
import os
import json
import stat
from glob import glob
import fnmatch
import re
import inspect
from types import TracebackType, FrameType
from typing import List, Optional, Union

from e2b.template.consts import BASE_STEP_NAME, FINALIZE_STEP_NAME


def read_dockerignore(context_path: str) -> List[str]:
    """
    Read and parse a .dockerignore file.

    :param context_path: Directory path containing the .dockerignore file

    :return: Array of ignore patterns (empty lines and comments are filtered out)
    """
    dockerignore_path = os.path.join(context_path, ".dockerignore")
    if not os.path.exists(dockerignore_path):
        return []

    with open(dockerignore_path, "r", encoding="utf-8") as f:
        content = f.read()

    return [
        line.strip()
        for line in content.split("\n")
        if line.strip() and not line.strip().startswith("#")
    ]


def calculate_files_hash(
    src: str,
    dest: str,
    context_path: str,
    ignore_patterns: List[str],
    resolve_symlinks: bool,
    stack_trace: Optional[TracebackType],
) -> str:
    """
    Calculate a hash of files being copied to detect changes for cache invalidation.

    The hash includes file content, metadata (mode, uid, gid, size, mtime), and relative paths.

    :param src: Source path pattern for files to copy
    :param dest: Destination path where files will be copied
    :param context_path: Base directory for resolving relative paths
    :param ignore_patterns: Glob patterns to ignore
    :param resolve_symlinks: Whether to resolve symbolic links when hashing
    :param stack_trace: Optional stack trace for error reporting

    :return: Hex string hash of all files

    :raises ValueError: If no files match the source pattern
    """
    src_path = os.path.join(context_path, src)
    hash_obj = hashlib.sha256()
    content = f"COPY {src} {dest}"

    hash_obj.update(content.encode())

    files_glob = glob(src_path, recursive=True)

    files = []
    for file in files_glob:
        if ignore_patterns and any(
            fnmatch.fnmatch(file, pattern) for pattern in ignore_patterns
        ):
            continue
        files.append(file)

    if len(files) == 0:
        raise ValueError(f"No files found in {src_path}").with_traceback(stack_trace)

    def hash_stats(stat_info: os.stat_result) -> None:
        hash_obj.update(str(stat_info.st_mode).encode())
        hash_obj.update(str(stat_info.st_uid).encode())
        hash_obj.update(str(stat_info.st_gid).encode())
        hash_obj.update(str(stat_info.st_size).encode())
        hash_obj.update(str(stat_info.st_mtime).encode())

    for file in files:
        # Add a relative path to hash calculation
        relative_path = os.path.relpath(file, context_path)
        hash_obj.update(relative_path.encode())

        # Add stat information to hash calculation
        if os.path.islink(file):
            stats = os.lstat(file)
            should_follow = resolve_symlinks and (
                os.path.isfile(file) or os.path.isdir(file)
            )

            if not should_follow:
                hash_stats(stats)

                content = os.readlink(file)
                hash_obj.update(content.encode())
                continue

        stats = os.stat(file)
        hash_stats(stats)

        if stat.S_ISREG(stats.st_mode):
            with open(file, "rb") as f:
                hash_obj.update(f.read())

    return hash_obj.hexdigest()


def strip_ansi_escape_codes(text: str) -> str:
    """
    Strip ANSI escape codes from a string.

    Source: https://github.com/chalk/ansi-regex/blob/main/index.js

    :param text: String with ANSI escape codes

    :return: String without ANSI escape codes
    """
    # Valid string terminator sequences are BEL, ESC\, and 0x9c
    st = r"(?:\u0007|\u001B\u005C|\u009C)"
    pattern = [
        rf"[\u001B\u009B][\[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?{st})",
        r"(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))",
    ]
    ansi_escape = re.compile("|".join(pattern), re.UNICODE)
    return ansi_escape.sub("", text)


def get_caller_frame(depth: int) -> Optional[FrameType]:
    """
    Get the caller's stack frame at a specific depth.

    This is used to provide better error messages and debugging information
    by tracking where template methods were called from in user code.

    :param depth: The depth of the stack trace to retrieve

    :return: The caller frame, or None if not available
    """
    stack = inspect.stack()[1:]
    if len(stack) < depth + 1:
        return None
    return stack[depth].frame


def get_caller_directory(depth: int) -> Optional[str]:
    """
    Get the directory of the caller at a specific stack depth.

    This is used to determine the file_context_path when creating a template,
    so file paths are resolved relative to the user's template file location.

    :param depth: The depth of the stack trace

    :return: The caller's directory path, or None if not available
    """
    try:
        # Get the stack trace
        caller_frame = get_caller_frame(depth)
        if caller_frame is None:
            return None

        caller_file = caller_frame.f_code.co_filename

        # Return the directory of the caller file
        return os.path.dirname(os.path.abspath(caller_file))
    except Exception:
        return None


def pad_octal(mode: int) -> str:
    """
    Convert a numeric file mode to a zero-padded octal string.

    :param mode: File mode as a number (e.g., 493 for 0o755)

    :return: Zero-padded 4-digit octal string (e.g., "0755")

    Example
    ```python
    pad_octal(0o755)  # Returns "0755"
    pad_octal(0o644)  # Returns "0644"
    ```
    """
    return f"{mode:04o}"


def get_build_step_index(step: str, stack_traces_length: int) -> int:
    """
    Get the array index for a build step based on its name.

    Special steps:
    - BASE_STEP_NAME: Returns 0 (first step)
    - FINALIZE_STEP_NAME: Returns the last index
    - Numeric strings: Converted to number

    :param step: Build step name or number as string
    :param stack_traces_length: Total number of stack traces (used for FINALIZE_STEP_NAME)

    :return: Index for the build step
    """
    if step == BASE_STEP_NAME:
        return 0

    if step == FINALIZE_STEP_NAME:
        return stack_traces_length - 1

    return int(step)


def read_gcp_service_account_json(
    context_path: str, path_or_content: Union[str, dict]
) -> str:
    """
    Read GCP service account JSON from a file or object.

    :param context_path: Base directory for resolving relative file paths
    :param path_or_content: Either a path to a JSON file or a service account object

    :return: Service account JSON as a string
    """
    if isinstance(path_or_content, str):
        with open(
            os.path.join(context_path, path_or_content), "r", encoding="utf-8"
        ) as f:
            return f.read()
    else:
        return json.dumps(path_or_content)
