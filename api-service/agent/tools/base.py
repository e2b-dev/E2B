from typing import Generator, Any
from langchain.tools import BaseTool

from session.playground.nodejs import NodeJSPlayground

from .human.tools import create_human_tools
from .playground.tools.code import create_code_tools


def create_tools(
    playground: NodeJSPlayground,
) -> Generator[BaseTool, None, None]:
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    playground_tools: Generator[Any, None, None] = (
        tool
        for tools in (
            tool_factory(playground=playground)
            for tool_factory in [
                # create_filesystem_tools,
                # create_process_tools,
                create_code_tools,
            ]
        )
        for tool in tools
    )
    yield from playground_tools

    human_tools = create_human_tools()
    yield from human_tools
