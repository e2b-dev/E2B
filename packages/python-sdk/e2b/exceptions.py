import requests

from connect.client import Code, ConnectException


def format_sandbox_timeout_exception(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout."
    )


# TODO: Improve the messages
def handle_envd_api_exception(res: requests.Response):
    if res.status_code == 400:
        return InvalidUserException(res.json().get("message"))
    elif res.status_code == 403:
        return InvalidPathException(res.json().get("message"))
    elif res.status_code == 404:
        return NotFoundException(res.json().get("message"))
    elif res.status_code == 412:
        return InvalidPathException(res.json().get("message"))
    elif res.status_code == 502:
        return format_sandbox_timeout_exception(res.json().get("message"))
    elif res.status_code == 507:
        return NotEnoughDiskSpaceException(res.json().get("message"))
    elif res.status_code >= 400:
        return SandboxException(f"{res.status_code}: {res.json().get('message')}")
    return None


def handle_rpc_exception(e: Exception):
    if isinstance(e, ConnectException):
        if e.status == Code.invalid_argument:
            return InvalidUserException(e.message)
        elif e.status == Code.not_found:
            return NotFoundException(e.message)
        elif e.status == Code.unavailable:
            return format_sandbox_timeout_exception(e.message)
        elif e.status == Code.canceled:
            return TimeoutException(
                f"{e.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request."
            )
        elif e.status == Code.deadline_exceeded:
            return TimeoutException(
                f"{e.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout."
            )
        else:
            return SandboxException(f"{e.status}: {e.message}")
    else:
        return e


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
