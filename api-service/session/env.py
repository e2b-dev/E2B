from functools import reduce
from typing import List, TypedDict


class EnvVar(TypedDict):
    key: str
    value: str


def format_env_vars(envs: List[EnvVar]) -> dict[str, str]:
    return reduce(
        lambda acc, env: {
            **acc,
            **({env["key"]: env["value"]} if env["key"] else {}),
        },
        envs,
        {},
    )
