from typing import Generator, Tuple, Any
from langchain.tools import BaseTool

from session.playground.nodejs import NodeJSPlayground
from session.session import GetEnvs

from .tools.code import create_code_tools


def create_playground_tools(
    get_envs: GetEnvs,
) -> Tuple[Generator[BaseTool, None, None], NodeJSPlayground]:
    playground = NodeJSPlayground(get_envs)

    subtools: Generator[Any, None, None] = (
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
    return subtools, playground
