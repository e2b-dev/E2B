from typing import Literal, cast

RunningSandboxState = Literal["paused", "running"]

RUNNING_SANDBOX_STATE_VALUES: set[RunningSandboxState] = {
    "paused",
    "running",
}


def check_running_sandbox_state(value: str) -> RunningSandboxState:
    if value in RUNNING_SANDBOX_STATE_VALUES:
        return cast(RunningSandboxState, value)
    raise TypeError(f"Unexpected value {value!r}. Expected one of {RUNNING_SANDBOX_STATE_VALUES!r}")
