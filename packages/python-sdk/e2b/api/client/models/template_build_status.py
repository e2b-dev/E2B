from typing import Literal, cast

TemplateBuildStatus = Literal["building", "error", "ready", "waiting"]

TEMPLATE_BUILD_STATUS_VALUES: set[TemplateBuildStatus] = {
    "building",
    "error",
    "ready",
    "waiting",
}


def check_template_build_status(value: str) -> TemplateBuildStatus:
    if value in TEMPLATE_BUILD_STATUS_VALUES:
        return cast(TemplateBuildStatus, value)
    raise TypeError(
        f"Unexpected value {value!r}. Expected one of {TEMPLATE_BUILD_STATUS_VALUES!r}"
    )
