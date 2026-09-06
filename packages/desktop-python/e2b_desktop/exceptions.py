from e2b import SandboxException


class DesktopStartupException(SandboxException):
    """Desktop startup failed and sandbox cleanup could not be confirmed.

    The sandbox may still be running. Use ``sandbox_id`` for targeted cleanup,
    inspect ``__cause__`` for the startup failure, and ``cleanup_error`` for the
    kill failure.
    """

    sandbox_id: str
    cleanup_error: Exception

    def __init__(
        self, sandbox_id: str, startup_error: Exception, cleanup_error: Exception
    ) -> None:
        super().__init__(
            "Desktop startup failed and sandbox cleanup could not be confirmed."
        )
        self.sandbox_id = sandbox_id
        self.__cause__ = startup_error
        self.cleanup_error = cleanup_error
