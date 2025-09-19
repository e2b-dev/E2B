import hashlib
import os
import json
from glob import glob
import fnmatch
import re
import inspect
from types import TracebackType, FrameType
from typing import List, Optional, Union

from e2b.template.consts import BASE_STEP_NAME, FINALIZE_STEP_NAME


def read_dockerignore(context_path: str) -> List[str]:
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
    ignore_patterns: Optional[List[str]] = None,
    stack_trace: Optional[TracebackType] = None,
) -> str:
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

    for file in files:
        if not os.path.isfile(file):
            # skip folders
            continue
        with open(file, "rb") as f:
            hash_obj.update(f.read())

    return hash_obj.hexdigest()


def strip_ansi_escape_codes(text: str) -> str:
    """Strip ANSI escape codes from a string. Source: https://github.com/chalk/ansi-regex/blob/main/index.js"""
    # Valid string terminator sequences are BEL, ESC\, and 0x9c
    st = r"(?:\u0007|\u001B\u005C|\u009C)"
    pattern = [
        rf"[\u001B\u009B][\[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?{st})",
        r"(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))",
    ]
    ansi_escape = re.compile("|".join(pattern), re.UNICODE)
    return ansi_escape.sub("", text)


def get_caller_frame(depth: int) -> Optional[FrameType]:
    """Get the caller frame. Skip this function (first frame)."""
    stack = inspect.stack()[1:]
    if len(stack) < depth + 1:
        return None
    return stack[depth].frame


def get_caller_directory(depth: int) -> Optional[str]:
    """Get the directory of the file that called this function."""
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
    return f"{mode:04o}"


def get_build_step_index(step: str, stack_traces_length: int) -> int:
    if step == BASE_STEP_NAME:
        return 0

    if step == FINALIZE_STEP_NAME:
        return stack_traces_length - 1

    return int(step)


def read_gcp_service_account_json(
    context_path: str, path_or_content: Union[str, dict]
) -> str:
    if isinstance(path_or_content, str):
        with open(
            os.path.join(context_path, path_or_content), "r", encoding="utf-8"
        ) as f:
            return f.read()
    else:
        return json.dumps(path_or_content)
