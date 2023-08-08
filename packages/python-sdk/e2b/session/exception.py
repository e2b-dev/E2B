from typing import List


class SessionException(Exception):
    pass


class MultipleExceptions(Exception):
    def __init__(self, message: str, exceptions: List[Exception]):
        super().__init__(f"Multiple exceptions occurred: {message}")
        self.exceptions = exceptions


class FilesystemException(SessionException):
    pass


class ProcessException(SessionException):
    pass


class TerminalException(SessionException):
    pass
