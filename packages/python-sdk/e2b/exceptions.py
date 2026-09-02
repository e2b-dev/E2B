from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional


def parse_retry_after(retry_after_header: Optional[str]) -> Optional[int]:
    """Parse an HTTP ``Retry-After`` header into a wait time in seconds.

    Returns ``None`` when the header is absent or not parseable. Numeric
    values (delta-seconds) are used directly; HTTP-date values are converted
    to a relative delay against the current time.
    """
    if not retry_after_header:
        return None

    trimmed = retry_after_header.strip()
    try:
        return max(int(trimmed), 0)
    except ValueError:
        pass

    try:
        retry_at = parsedate_to_datetime(trimmed)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None

    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)

    return max(int((retry_at - datetime.now(timezone.utc)).total_seconds()), 0)


def format_sandbox_timeout_exception(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout."
    )


def format_request_timeout_error() -> Exception:
    return TimeoutException(
        "Request timed out — the 'request_timeout' option can be used to increase this timeout",
    )


class SandboxException(Exception):
    """
    Base class for all sandbox errors.

    Raised when a general sandbox exception occurs.
    """

    pass


class TimeoutException(SandboxException):
    """
    Raised when a timeout occurs.

    The `unavailable` exception type is caused by sandbox timeout.\n
    The `canceled` exception type is caused by exceeding request timeout.\n
    The `deadline_exceeded` exception type is caused by exceeding the timeout for process, watch, etc.\n
    The `unknown` exception type is sometimes caused by the sandbox timeout when the request is not processed correctly.\n
    """

    pass


class InvalidArgumentException(SandboxException):
    """
    Raised when an invalid argument is provided.
    """

    pass


class NotEnoughSpaceException(SandboxException):
    """
    Raised when there is not enough disk space.
    """

    pass


class NotFoundException(SandboxException):
    """
    Raised when a resource is not found.

    .. deprecated::
        Use :class:`FileNotFoundException` or :class:`SandboxNotFoundException` instead.
        This class will be removed in the next major version.
    """

    pass


class FileNotFoundException(NotFoundException):
    """
    Raised when a file or directory is not found inside a sandbox.
    """

    pass


class SandboxNotFoundException(NotFoundException):
    """
    Raised when a sandbox is not found (e.g. it doesn't exist or is no longer running).
    """

    pass


class AuthenticationException(Exception):
    """
    Raised when authentication fails.
    """

    pass


class GitAuthException(AuthenticationException):
    """
    Raised when git authentication fails.

    :deprecated: Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
    """

    pass


class GitUpstreamException(SandboxException):
    """
    Raised when git upstream tracking is missing.

    :deprecated: Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
    """

    pass


class TemplateException(SandboxException):
    """
    Exception raised when the template uses old envd version. It isn't compatible with the new SDK.
    """


class RateLimitException(SandboxException):
    """
    Raised when the API rate limit is exceeded.

    ``retry_after`` is the parsed wait in seconds from the ``Retry-After``
    response header when present. ``retry_after_header`` is the raw header
    value.
    """

    retry_after: Optional[int]
    retry_after_header: Optional[str]

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        retry_after_header: Optional[str] = None,
    ):
        if retry_after is None:
            retry_after = parse_retry_after(retry_after_header)
        if retry_after is not None:
            message = f"{message} Retry after {retry_after} seconds."
        super().__init__(message)
        self.retry_after = retry_after
        self.retry_after_header = retry_after_header


class BuildException(Exception):
    """
    Raised when the build fails.
    """


class FileUploadException(BuildException):
    """
    Raised when the file upload fails.
    """


class VolumeException(Exception):
    """
    Base class for all volume errors.

    Raised when general volume errors occur.
    """


class VolumeNotFoundException(NotFoundException):
    """
    Raised when a volume is not found.
    """


class VolumePathNotFoundException(NotFoundException):
    """
    Raised when a file or directory is not found inside a volume.
    """


class SecretException(Exception):
    """
    Base class for all secret errors.

    Raised when general secret errors occur.
    """


class SecretNotFoundException(SecretException):
    """
    Raised when a secret is not found.
    """
