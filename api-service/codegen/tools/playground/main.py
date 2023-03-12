from typing import List
from langchain.tools.base import BaseTool

from .playground import NodeJSPlayground, Playground
from .tools.filesystem import create_filesystem_tools
from .tools.process import create_process_tools
from .tools.code import create_code_tools


# TODO: Improve all descriptions of tools
def create_playground_tools() -> tuple[List[BaseTool], Playground]:
    playground = NodeJSPlayground()
    subtools = [
        tool
        for tools in (
            tool_factory(playground)
            for tool_factory in [
                create_filesystem_tools,
                create_process_tools,
                create_code_tools,
            ]
        )
        for tool in tools
    ]
    return playground, subtools
