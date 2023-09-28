import os
import warnings
from typing import Optional


def resolve_path(path: str, cwd: Optional[str]) -> str:
    if path.startswith("./"):
        if not cwd:
            raise warnings.warn(
                f"Path starts with './' and cwd isn't set. The path {path} will evaluate to `{path[1:]}`, which may not be what you want."
            )

        return os.path.join(cwd or "", path[1:])

    if path.startswith("../"):
        if not cwd:
            raise warnings.warn(
                f"Path starts with '../' and cwd isn't set. The path {path} will evaluate to `{path[2:]}`, which may not be what you want."
            )
        return os.path.join(cwd or "", path[2:])

    if path.startswith("~/"):
        if not cwd:
            raise warnings.warn(
                f"Path starts with '~/' and cwd isn't set. The path {path} will evaluate to `/home/user/{path[2:]}`, which may not be what you want."
            )
        return os.path.join(cwd or "/home/user", path[1:])

    if not path.startswith("/") and cwd:
        return os.path.join(cwd, path)
    return path
