from typing import Literal, cast

NodeStatus = Literal["draining", "ready"]

NODE_STATUS_VALUES: set[NodeStatus] = {
    "draining",
    "ready",
}


def check_node_status(value: str) -> NodeStatus:
    if value in NODE_STATUS_VALUES:
        return cast(NodeStatus, value)
    raise TypeError(f"Unexpected value {value!r}. Expected one of {NODE_STATUS_VALUES!r}")
