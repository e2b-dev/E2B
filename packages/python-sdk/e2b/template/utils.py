import hashlib
import os
import io
import tarfile
import json
import stat
from wcmatch import glob
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


def normalize_path(path: str) -> str:
    """
    Normalize path separators to forward slashes for glob patterns (glob expects / even on Windows).

    :param path: The path to normalize
    :return: The normalized path
    """
    return path.replace(os.sep, "/")


def get_all_files_in_path(
    src: str,
    context_path: str,
    ignore_patterns: List[str],
    include_directories: bool = True,
) -> List[str]:
    """
    Get all files for a given path and ignore patterns.

    :param src: Path to the source directory
    :param context_path: Base directory for resolving relative paths
    :param ignore_patterns: Ignore patterns
    :param include_directories: Whether to include directories
    :return: Array of files
    """
    files = set()

    # Use glob to find all files/directories matching the pattern under context_path
    abs_context_path = os.path.abspath(context_path)
    files_glob = glob.glob(
        src,
        flags=glob.GLOBSTAR,
        root_dir=abs_context_path,
        exclude=ignore_patterns,
    )

    for file in files_glob:
        # Join it with abs_context_path to get the absolute path
        file_path = os.path.join(abs_context_path, file)

        if os.path.isdir(file_path):
            # If it's a directory, add the directory and all entries recursively
            if include_directories:
                files.add(file_path)
            dir_files = glob.glob(
                normalize_path(file) + "/**/*",
                flags=glob.GLOBSTAR,
                root_dir=abs_context_path,
                exclude=ignore_patterns,
            )
            for dir_file in dir_files:
                dir_file_path = os.path.join(abs_context_path, dir_file)
                files.add(dir_file_path)
        else:
            files.add(file_path)

    return sorted(list(files))


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

    The hash includes file content, metadata (mode, size), and relative paths.
    Note: uid, gid, and mtime are excluded to ensure stable hashes across environments.

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

    files = get_all_files_in_path(src, context_path, ignore_patterns, True)

    if len(files) == 0:
        raise ValueError(f"No files found in {src_path}").with_traceback(stack_trace)

    def hash_stats(stat_info: os.stat_result) -> None:
        # Only include stable metadata (mode, size)
        # Exclude uid, gid, and mtime to ensure consistent hashes across environments
        hash_obj.update(str(stat_info.st_mode).encode())
        hash_obj.update(str(stat_info.st_size).encode())

    for file in files:
        # Hash the relative path
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


def tar_file_stream(
    file_name: str,
    file_context_path: str,
    ignore_patterns: List[str],
    resolve_symlinks: bool,
) -> io.BytesIO:
    """
    Create a tar stream of files matching a pattern.

    :param file_name: Glob pattern for files to include
    :param file_context_path: Base directory for resolving file paths
    :param ignore_patterns: Ignore patterns
    :param resolve_symlinks: Whether to resolve symbolic links

    :return: Tar stream
    """
    tar_buffer = io.BytesIO()
    with tarfile.open(
        fileobj=tar_buffer,
        mode="w:gz",
        dereference=resolve_symlinks,
    ) as tar:
        files = get_all_files_in_path(
            file_name, file_context_path, ignore_patterns, True
        )
        for file in files:
            tar.add(
                file, arcname=os.path.relpath(file, file_context_path), recursive=False
            )

    return tar_buffer


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
