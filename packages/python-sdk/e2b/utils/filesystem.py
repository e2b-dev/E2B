import os
import warnings
from typing import Optional


def resolve_path(path: str, cwd: Optional[str] = None) -> str:
    warning = f"Path starts with %()s and cwd isn't set. The path {path} will evaluate to `%()s`, which may not be what you want."
    if path.startswith("./"):
        result = os.path.join(cwd or "/home/user", path)
        if not cwd:
            warnings.warn(warning.format("./", result))
        return result

    if path.startswith("../"):
        result = os.path.join(cwd or "/home/user", path)
        if not cwd:
            warnings.warn(warning.format("../", result))
        return result

    if path.startswith("~/"):
        result = os.path.join("/home/user", path[2:])
        warnings.warn(warning.format("~/", result))
        return result

    if not path.startswith("/") and cwd:
        return os.path.join(cwd, path)

    return path
