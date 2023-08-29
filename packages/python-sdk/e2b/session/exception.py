from typing import Dict, List, Optional


class SessionException(Exception):
    pass


class RpcException(SessionException):
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


class MultipleExceptions(SessionException):
    def __init__(self, message: str, exceptions: List[Exception]):
        super().__init__(f"Multiple exceptions occurred: {message}")
        self.exceptions = exceptions


class FilesystemException(SessionException):
    pass


class ProcessException(SessionException):
    pass


class TerminalException(SessionException):
    pass


class AuthenticationException(SessionException):
    pass
