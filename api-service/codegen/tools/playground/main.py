from typing import List, Any

from .playground import NodeJSPlayground, Playground
from .tools.filesystem import create_filesystem_tools
from .tools.process import create_process_tools
from .tools.code import create_code_tools


# TODO: Specify that the environmetn is persistent between tools' invocations?
# TODO: Use ubuntu instead of alpine?
def create_playground_tools() -> tuple[List[Any], Playground]:
    playground = NodeJSPlayground()
    subtools = [
        tool
        for tools in (
            tool_factory(playground)
            for tool_factory in [
                # create_filesystem_tools,
                create_process_tools,
                create_code_tools,
            ]
        )
        for tool in tools
    ]
    return subtools, playground
