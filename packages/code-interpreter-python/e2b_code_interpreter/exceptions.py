from e2b import TimeoutException


def format_request_timeout_error() -> Exception:
    return TimeoutException(
        "Request timed out — the 'request_timeout' option can be used to increase this timeout",
    )


def format_execution_timeout_error() -> Exception:
    return TimeoutException(
        "Execution timed out — the 'timeout' option can be used to increase this timeout",
    )


def format_sandbox_killed_error() -> Exception:
    return TimeoutException(
        "The sandbox was killed while the request was in progress. This can happen when the sandbox times out or is killed manually. "
        "You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout",
    )
