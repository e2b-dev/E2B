from typing import Optional

from e2b.exceptions import InvalidArgumentException


def resolve_config_scope(
    scope: Optional[str], path: Optional[str]
) -> tuple[str, Optional[str]]:
    """
    Resolve a git config scope flag and repository path.

    :param scope: Requested scope ("global", "local", "system")
    :param path: Repository path for local scope
    :return: Tuple of (scope flag, repository path)
    """
    scope_name = (scope or "global").strip().lower()
    if scope_name not in {"global", "local", "system"}:
        raise InvalidArgumentException(
            "Git config scope must be one of: global, local, system."
        )

    if scope_name == "local":
        if not path:
            raise InvalidArgumentException(
                "Repository path is required when scope is local."
            )
        return "--local", path

    if scope_name == "system":
        return "--system", None

    return "--global", None
