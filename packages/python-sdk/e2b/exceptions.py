from typing import Optional


# Message of the 502 the proxy in front of envd answers with when the sandbox
# is running but nothing listens on envd's port — e.g. its network is down.
def format_sandbox_timeout_exception(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout."
    )


# Messages of the 502 the proxy in front of envd answers with when the sandbox does
# not exist anymore (killed or reached its timeout) or when it is running but envd's
# port is not open (e.g. its network is down).
SANDBOX_NOT_FOUND_MESSAGE = "was not found"
SANDBOX_PORT_CLOSED_MESSAGE = "port is not open"


def is_sandbox_not_found_message(message: str) -> bool:
    return SANDBOX_NOT_FOUND_MESSAGE in message


def is_sandbox_port_closed_message(message: str) -> bool:
    return SANDBOX_PORT_CLOSED_MESSAGE in message


def format_sandbox_unavailable_exception(message: str) -> Exception:
    """Map a 502/UNAVAILABLE answered by the proxy in front of envd -- the sandbox was
    not found (killed or reached its timeout), or it is running but envd's port is
    not open (e.g. its network is down) -- to a ``SandboxUnreachableException``."""
    return SandboxUnreachableException(
        f"{message}: The sandbox could not be reached -- it was killed, reached its timeout, or envd inside it is not reachable (e.g. its network is down). Check the sandbox state with 'Sandbox.get_info()'; you can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout."
    )


def format_sandbox_start_unavailable_exception(message: str) -> Exception:
    """Like :func:`format_sandbox_unavailable_exception`, for starting a command/PTY/
    watch: when the proxy reports the sandbox was not found, a
    ``SandboxNotFoundException`` is returned."""
    if is_sandbox_not_found_message(message):
        return SandboxNotFoundException(
            f"{message}: The sandbox was killed or reached its timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout."
        )
    return format_sandbox_unavailable_exception(message)


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


class SandboxUnreachableException(TimeoutException):
    """
    Raised when the sandbox could not be reached while not confirmed to be
    stopped: either the proxy in front of the sandbox reports it running but
    envd's port not open (e.g. the sandbox's network is down), or a request
    failed at the connection level (the connection could not be established or
    was dropped mid-request) and a follow-up health probe got no answer from the
    sandbox either.

    This usually means the sandbox's network is down, envd inside it is not up
    (yet), or a transient network issue between the client and the sandbox.
    Check the sandbox state with ``Sandbox.get_info()`` and retry the request.

    Subclass of ``TimeoutException``, which these cases surfaced as before.
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


class ServiceBusyException(Exception):
    """
    Raised when the API refused the operation because the service is
    temporarily busy (HTTP 503): no capacity to place a sandbox right now, or
    the node running the sandbox declined a request it cannot serve yet.

    Nothing was changed by the refused call: for example a refused pause
    leaves the sandbox running with its state intact, so the same call can be
    retried after a short wait.

    Like `AuthenticationException` and unlike the other API errors, this is not
    a `SandboxException`: it is raised for every 503 whatever the operation, so
    catch it explicitly.

    :param status_code: HTTP status of the API response: always 503.
    """

    status_code = 503


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
