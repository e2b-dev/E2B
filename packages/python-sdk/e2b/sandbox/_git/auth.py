from typing import Optional
from urllib.parse import urlparse, urlunparse

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.commands.command_handle import CommandExitException


def with_credentials(url: str, username: Optional[str], password: Optional[str]) -> str:
    """
    Add HTTP(S) credentials to a Git URL.

    :param url: Git repository URL
    :param username: Username for HTTP(S) authentication
    :param password: Password or token for HTTP(S) authentication
    :return: URL with embedded credentials
    """
    if not username and not password:
        return url
    if not username or not password:
        raise InvalidArgumentException(
            "Both username and password are required when using Git credentials."
        )

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise InvalidArgumentException(
            "Only http(s) Git URLs support username/password credentials."
        )

    netloc = f"{username}:{password}@{parsed.netloc}"
    return urlunparse(parsed._replace(netloc=netloc))


def strip_credentials(url: str) -> str:
    """
    Strip HTTP(S) credentials from a Git URL.

    :param url: Git repository URL
    :return: URL without embedded credentials
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url
    if not parsed.username and not parsed.password:
        return url

    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"

    return urlunparse(parsed._replace(netloc=host))


def is_auth_failure(err: Exception) -> bool:
    """
    Check whether a git command failed due to authentication issues.

    :param err: Exception raised by a git command
    :return: True when the error matches common authentication failures
    """
    if not isinstance(err, CommandExitException):
        return False

    message = f"{err.stderr}\n{err.stdout}".lower()
    auth_snippets = [
        "authentication failed",
        "terminal prompts disabled",
        "could not read username",
        "invalid username or password",
        "access denied",
        "permission denied",
        "not authorized",
    ]
    return any(snippet in message for snippet in auth_snippets)


def is_missing_upstream(err: Exception) -> bool:
    """
    Check whether a git command failed due to missing upstream tracking.

    :param err: Exception raised by a git command
    :return: True when the error matches common upstream failures
    """
    if not isinstance(err, CommandExitException):
        return False

    message = f"{err.stderr}\n{err.stdout}".lower()
    upstream_snippets = [
        "has no upstream branch",
        "no upstream branch",
        "no upstream configured",
        "no tracking information for the current branch",
        "no tracking information",
        "set the remote as upstream",
        "set the upstream branch",
        "please specify which branch you want to merge with",
    ]
    return any(snippet in message for snippet in upstream_snippets)


def build_auth_error_message(action: str, missing_password: bool) -> str:
    """
    Build a git authentication error message for the given action.

    :param action: Git action name
    :param missing_password: Whether the password/token is missing
    :return: Error message string
    """
    if missing_password:
        return f"Git {action} requires a password/token for private repositories."
    return f"Git {action} requires credentials for private repositories."


def build_upstream_error_message(action: str) -> str:
    """
    Build a git upstream tracking error message for the given action.

    :param action: Git action name
    :return: Error message string
    """
    if action == "push":
        return (
            "Git push failed because no upstream branch is configured. "
            "Set upstream once with set_upstream=True (and optional remote/branch), "
            "or pass remote and branch explicitly."
        )

    return (
        "Git pull failed because no upstream branch is configured. "
        "Pass remote and branch explicitly, or set upstream once (push with "
        "set_upstream=True or run: git branch --set-upstream-to=origin/<branch> <branch>)."
    )
