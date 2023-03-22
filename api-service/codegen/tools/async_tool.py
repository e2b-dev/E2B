from typing import Awaitable, Callable, Optional
from langchain.agents import Tool
from langchain.tools.base import BaseTool


def func(_: str):
    raise NotImplementedError()


def async_tool(name: str) -> Callable:
    def _make_tool(arun: Optional[Callable[[str], Awaitable[str]]]) -> BaseTool:
        if arun.__doc__ is None:
            raise NotImplementedError(f"Missing docstring for {name} async tool")

        description = f"{arun.__doc__.strip()}"
        tool_ = Tool(
            name=name,
            func=func,
            description=description,
            return_direct=False,
        )
        tool_.coroutine = arun
        return tool_

    return _make_tool
