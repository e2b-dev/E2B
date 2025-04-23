from typing import Literal, cast

SandboxState = Literal["paused", "running"]

SANDBOX_STATE_VALUES: set[SandboxState] = {
    "paused",
    "running",
}


def check_sandbox_state(value: str) -> SandboxState:
    if value in SANDBOX_STATE_VALUES:
        return cast(SandboxState, value)
    raise TypeError(
        f"Unexpected value {value!r}. Expected one of {SANDBOX_STATE_VALUES!r}"
    )
