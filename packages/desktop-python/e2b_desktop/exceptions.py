from e2b import SandboxException


class DesktopStartupException(SandboxException):
    """Desktop startup failed and sandbox cleanup could not be confirmed.

    The sandbox may still be running. Use ``sandbox_id`` for targeted cleanup,
    inspect ``__cause__`` for the startup failure, and ``cleanup_error`` for the
    kill failure.

    :param sandbox_id: ID of the allocated sandbox whose cleanup failed.
    :param startup_error: Original startup exception, retained as ``__cause__``.
    :param cleanup_error: Original cleanup exception.
    """

    sandbox_id: str
    cleanup_error: Exception

    def __init__(
        self, sandbox_id: str, startup_error: Exception, cleanup_error: Exception
    ) -> None:
        super().__init__(
            f"Desktop startup failed and cleanup of sandbox {sandbox_id} could not be confirmed. "
            f"The sandbox may still be running - reclaim it with `Sandbox.kill('{sandbox_id}')`."
        )
        self.sandbox_id = sandbox_id
        self.__cause__ = startup_error
        self.cleanup_error = cleanup_error
