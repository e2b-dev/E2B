import os

from typing import Literal, Optional


DOMAIN = os.getenv("E2B_DOMAIN", "e2b.dev")
DEBUG = os.getenv("E2B_DEBUG", "false") == "true"
API_KEY = os.getenv("E2B_API_KEY")
ACCESS_TOKEN = os.getenv("E2B_ACCESS_TOKEN")

REQUEST_TIMEOUT: float = 30  # 30s


# // This is the message for the sandbox timeout error when the response code is 502/Unavailable
# function formatSandboxTimeoutError(message: string) {
#   return new TimeoutError(
#     `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`,
#   )
# }


def format_sandbox_timeout_error(message: str):
    return TimeoutException(
        f"{message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout."
    )


# export function handleEnvdApiError(err: {
#   code: number;
#   message: string;
# } | undefined) {
#   switch (err?.code) {
#     case 400:
#       return new InvalidUserError(err.message)
#     case 403:
#       return new InvalidPathError(err.message)
#     case 404:
#       return new NotFoundError(err.message)
#     case 502:
#       return formatSandboxTimeoutError(err.message)
#     case 507:
#       return new NotEnoughDiskSpaceError(err.message)
#     default:
#       if (err) {
#         return new SandboxError(`${err.code}: ${err.message}`)
#       }
#   }
# }

# export function handleRpcError(err: unknown) {
#   if (err instanceof ConnectError) {
#     switch (err.code) {
#       case Code.InvalidArgument:
#         return new InvalidUserError(err.message)
#       case Code.NotFound:
#         return new InvalidPathError(err.message)
#       case Code.Unavailable:
#         return formatSandboxTimeoutError(err.message)
#       case Code.Canceled:
#         return new TimeoutError(
#           `${err.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request.`,
#         )
#       case Code.DeadlineExceeded:
#         return new TimeoutError(
#           `${err.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout.`,
#         )
#       default:
#         return new SandboxError(`${err.code}: ${err.message}`)
#     }
#   }

#   return err
# }


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


class ConnectionConfig:
    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        request_timeout: Optional[float] = None,
    ):
        self.domain = domain or DOMAIN
        self.debug = debug or DEBUG
        self.api_key = api_key or API_KEY
        self.access_token = access_token or ACCESS_TOKEN

        self.request_timeout = ConnectionConfig._get_request_timeout(
            REQUEST_TIMEOUT,
            request_timeout,
        )

        if request_timeout == 0:
            self.request_timeout = None
        elif request_timeout is not None:
            self.request_timeout = request_timeout
        else:
            self.request_timeout = REQUEST_TIMEOUT

        self.api_url = "http://localhost:3000" if debug else f"https://api.{domain}"

    @staticmethod
    def _get_request_timeout(
        default_timeout: Optional[float],
        request_timeout: Optional[float],
    ):
        if request_timeout == 0:
            return None
        elif request_timeout is not None:
            return request_timeout
        else:
            return default_timeout

    def get_request_timeout(self, request_timeout: Optional[float] = None):
        return self._get_request_timeout(self.request_timeout, request_timeout)


Username = Literal["root", "user"]
