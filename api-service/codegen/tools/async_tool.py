from typing import Awaitable, Callable, Optional, cast
from langchain.agents import Tool
from langchain.tools.base import BaseTool

from codegen.agent.parsing import ToolLog, parse_thoughts_and_actions


def func(_: str):
    raise NotImplementedError()


def async_tool(name: str | None = None) -> Callable:
    """You don't have to specify tool's name if there is an example of the tool use in the docstring."""

    def _make_tool(arun: Optional[Callable[[str], Awaitable[str]]]) -> BaseTool:
        nonlocal name
        if arun.__doc__ is None:
            raise NotImplementedError(f"Missing docstring for {name} async tool")

        # Check if the tool name in an example in tool description matches with the name of the tool.
        # This error is hard to detect because the model still sometimes uses the correct name
        # and not the incorrect name from the example.
        tool_example = next(
            (
                cast(ToolLog, tool)
                for tool in parse_thoughts_and_actions(arun.__doc__.strip())
                if tool["type"] == "tool"
            ),
            None,
        )

        if tool_example and not name and tool_example["tool_name"]:
            name = tool_example["tool_name"]

        if not name:
            raise ValueError(
                f"Tool name is not specified. Either specify it in the decorator parameter or add a tool description with an example to the docstring."
            )

        if tool_example and name != tool_example["tool_name"]:
            raise ValueError(
                f'Specified tool name "{name}" differs from the example tool name "{tool_example["tool_name"]}" in the tool description'
            )

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
