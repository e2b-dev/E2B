from typing import Literal, cast

ListedSandboxState = Literal["paused", "running"]

LISTED_SANDBOX_STATE_VALUES: set[ListedSandboxState] = {
    "paused",
    "running",
}


def check_listed_sandbox_state(value: str) -> ListedSandboxState:
    if value in LISTED_SANDBOX_STATE_VALUES:
        return cast(ListedSandboxState, value)
    raise TypeError(f"Unexpected value {value!r}. Expected one of {LISTED_SANDBOX_STATE_VALUES!r}")
