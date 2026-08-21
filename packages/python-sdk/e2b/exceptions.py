from typing import Optional, Protocol


class ExceptionFactory(Protocol):
    """Builds an exception from an error message and an optional trace ID.

    Exception classes satisfy this, so they can be used directly as factories
    in the HTTP status code maps.
    """

    def __call__(
        self, message: str, *, trace_id: Optional[str] = None
    ) -> Exception: ...


def _format_message_with_trace_id(message: str, trace_id: Optional[str] = None) -> str:
    if trace_id and message:
        return f"{message} (trace ID: {trace_id})"
    return message


def format_sandbox_timeout_exception(message: str, *, trace_id: Optional[str] = None):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout.",
        trace_id=trace_id,
    )


def format_request_timeout_error() -> Exception:
    return TimeoutException(
        "Request timed out — the 'request_timeout' option can be used to increase this timeout",
    )


class SandboxException(Exception):
    """
    Base class for all sandbox errors.

    Raised when a general sandbox exception occurs.

    :ivar trace_id: Trace ID of the failed request, when the response carried
        one.
    """

    # Class-level default so subclasses that bypass this ``__init__`` — the
    # ``@dataclass`` CommandExitException generates its own — still expose it
    trace_id: Optional[str] = None

    def __init__(self, message: str = "", *, trace_id: Optional[str] = None):
        super().__init__(_format_message_with_trace_id(message, trace_id))
        self.trace_id = trace_id


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

    :ivar trace_id: Trace ID of the failed request, when the response carried
        one.
    """

    trace_id: Optional[str] = None

    def __init__(self, message: str = "", *, trace_id: Optional[str] = None):
        super().__init__(_format_message_with_trace_id(message, trace_id))
        self.trace_id = trace_id


class GitAuthException(AuthenticationException):
    """
    Raised when git authentication fails.
    """

    pass


class GitUpstreamException(SandboxException):
    """
    Raised when git upstream tracking is missing.
    """

    pass


class TemplateException(SandboxException):
    """
    Exception raised when the template uses old envd version. It isn't compatible with the new SDK.
    """


class RateLimitException(SandboxException):
    """
    Raised when the API rate limit is exceeded.
    """


class BuildException(Exception):
    """
    Raised when the build fails.

    :ivar trace_id: Trace ID of the failed request, when the response carried
        one.
    """

    trace_id: Optional[str] = None

    def __init__(self, message: str = "", *, trace_id: Optional[str] = None):
        super().__init__(_format_message_with_trace_id(message, trace_id))
        self.trace_id = trace_id


class FileUploadException(BuildException):
    """
    Raised when the file upload fails.
    """


class VolumeException(Exception):
    """
    Base class for all volume errors.

    Raised when general volume errors occur.

    :ivar trace_id: Trace ID of the failed request, when the response carried
        one.
    """

    trace_id: Optional[str] = None

    def __init__(self, message: str = "", *, trace_id: Optional[str] = None):
        super().__init__(_format_message_with_trace_id(message, trace_id))
        self.trace_id = trace_id


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

    :ivar trace_id: Trace ID of the failed request, when the response carried
        one.
    """

    trace_id: Optional[str] = None

    def __init__(self, message: str = "", *, trace_id: Optional[str] = None):
        super().__init__(_format_message_with_trace_id(message, trace_id))
        self.trace_id = trace_id


class SecretNotFoundException(SecretException):
    """
    Raised when a secret is not found.
    """
