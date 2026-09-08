from typing import Optional


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

    :param status_code: HTTP status of the API response that produced this error, when there was one.
    """

    # Class-level default so subclasses that bypass this initializer (dataclass
    # exceptions such as CommandExitException) still expose the attribute.
    status_code: Optional[int] = None

    def __init__(self, *args, status_code: Optional[int] = None):
        super().__init__(*args)
        self.status_code = status_code


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
    """

    def __init__(self, *args):
        super().__init__(*args, status_code=429)


class ServiceBusyException(SandboxException):
    """
    Raised when the API refused the operation because the service is
    temporarily busy (HTTP 503): no capacity to place a sandbox right now, or
    the node running the sandbox declined a request it cannot serve yet.

    Nothing was changed by the refused call: for example a refused pause
    leaves the sandbox running with its state intact, so the same call can be
    retried after a short wait.
    """

    def __init__(self, *args):
        super().__init__(*args, status_code=503)


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
