from enum import Enum


class TimeoutType(str, Enum):
    """
    The type of timeout that occurred.

    - ``SANDBOX``: The sandbox itself timed out (e.g., idle timeout expired).
    - ``REQUEST``: The HTTP request timed out (exceeded ``request_timeout``).
    - ``EXECUTION``: A long-running operation timed out (exceeded ``timeout`` for command execution, watch, etc.).
    """

    SANDBOX = "sandbox"
    REQUEST = "request"
    EXECUTION = "execution"


def format_sandbox_timeout_exception(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout.",
        type=TimeoutType.SANDBOX,
    )


def format_request_timeout_error() -> Exception:
    return TimeoutException(
        "Request timed out — the 'request_timeout' option can be used to increase this timeout",
        type=TimeoutType.REQUEST,
    )


def format_execution_timeout_error() -> Exception:
    return TimeoutException(
        "Execution timed out — the 'timeout' option can be used to increase this timeout",
        type=TimeoutType.EXECUTION,
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

    The ``type`` attribute indicates the kind of timeout:

    - :attr:`TimeoutType.SANDBOX` — the sandbox itself timed out (idle timeout, etc.).
    - :attr:`TimeoutType.REQUEST` — the HTTP request exceeded ``request_timeout``.
    - :attr:`TimeoutType.EXECUTION` — a long-running operation exceeded its ``timeout``.
    """

    def __init__(self, message: str, type: TimeoutType = TimeoutType.SANDBOX):
        super().__init__(message)
        self.type = type


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
    """


class FileUploadException(BuildException):
    """
    Raised when the file upload fails.
    """
