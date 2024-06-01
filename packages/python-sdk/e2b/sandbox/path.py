import warnings

from pathlib import PurePosixPath
from typing import Optional


def resolve_path(path: str, cwd: Optional[str] = None) -> str:
    warning = f"Path starts with {{0}} and cwd isn't set. The path {path} will evaluate to `{{1}}`, which may not be what you want."
    if path.startswith("./"):
        result = PurePosixPath(cwd or "/home/user", path).as_posix()
        if not cwd:
            warnings.warn(warning.format("./", result))
        return result

    if path.startswith("../"):
        result = PurePosixPath(cwd or "/home/user", path).as_posix()
        if not cwd:
            warnings.warn(warning.format("../", result))
        return result

    if path.startswith("~/"):
        result = PurePosixPath("/home/user", path[2:]).as_posix()
        warnings.warn(warning.format("~/", result))
        return result

    if not path.startswith("/") and cwd:
        return PurePosixPath(cwd, path).as_posix()

    return path
