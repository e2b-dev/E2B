from typing import Literal, cast

GetSandboxesState = Literal["paused", "running"]

GET_SANDBOXES_STATE_VALUES: set[GetSandboxesState] = {
    "paused",
    "running",
}


def check_get_sandboxes_state(value: str) -> GetSandboxesState:
    if value in GET_SANDBOXES_STATE_VALUES:
        return cast(GetSandboxesState, value)
    raise TypeError(f"Unexpected value {value!r}. Expected one of {GET_SANDBOXES_STATE_VALUES!r}")
