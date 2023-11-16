from typing import Dict, List, Optional


class SandboxException(Exception):
    pass


class RpcException(SandboxException):
    def __init__(
        self,
        message: str,
        code: int,
        id: str,
        data: Optional[Dict] = None,
    ):
        super().__init__(message)
        self.data = data
        self.code = code
        self.message = message
        self.id = id


class MultipleExceptions(SandboxException):
    def __init__(self, message: str, exceptions: List[Exception]):
        super().__init__(f"Multiple exceptions occurred: {message}")
        self.exceptions = exceptions


class FilesystemException(SandboxException):
    pass


class ProcessException(SandboxException):
    pass


class CurrentWorkingDirectoryDoesntExistException(ProcessException):
    pass


class TerminalException(SandboxException):
    pass


class AuthenticationException(SandboxException):
    pass


class UnsupportedRuntimeException(SandboxException):
    pass


class TimeoutException(SandboxException):
    pass
