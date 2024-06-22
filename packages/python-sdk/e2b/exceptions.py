def format_sandbox_timeout_exception(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout."
    )


class SandboxException(Exception):
    pass


# [unknown] is sometimes caused by the sandbox timeout when the request is not processed
# [unavailable] is caused by sandbox timeout
# [canceled] is caused by exceeding request timeout
# [deadline_exceeded] is caused by exceeding the timeout (for process handlers, watch, etc)
class TimeoutException(SandboxException):
    pass


class NotEnoughDiskSpaceException(SandboxException):
    pass


class NotFoundException(SandboxException):
    pass


class InvalidPathException(SandboxException):
    pass


class InvalidUserException(SandboxException):
    pass


class AuthenticationException(SandboxException):
    pass
