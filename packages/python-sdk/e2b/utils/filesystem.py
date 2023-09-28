import os
import warnings
from typing import Optional


def resolve_path(path: str, cwd: Optional[str] = None) -> str:
    if path.startswith("./"):
        result = os.path.join(cwd or "/home/user", path[2:])
        if not cwd:
            warnings.warn(
                f"Path starts with './' and cwd isn't set. The path {path} will evaluate to `{result}`, which may not be what you want."
            )
        return result

    if path.startswith("../"):
        result = os.path.join(cwd or "/home/user", path)
        if not cwd:
            warnings.warn(
                f"Path starts with '../' and cwd isn't set. The path {path} will evaluate to `{result}`, which may not be what you want."
            )
        return result
    if path.startswith("~/"):
        warnings.warn(
            f"Path starts with '~/'. The path {path} will evaluate to `/home/user/{path[2:]}`, which may not be what you want."
        )
        return os.path.join("/home/user", path[2:])

    if not path.startswith("/") and cwd:
        return os.path.join(cwd, path)

    return path
