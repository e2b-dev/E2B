from typing import List, Any

from codegen.env import EnvVar
from codegen.tools.playground.mock.request import MockRequestFactory

from .playground import NodeJSPlayground, Playground
from .tools.filesystem import create_filesystem_tools
from .tools.process import create_process_tools
from .tools.code import create_code_tools


def create_playground_tools(
    envs: List[EnvVar],
    method: str,
    route: str,
    request_body_template: str,
) -> tuple[List[Any], Playground]:
    playground = NodeJSPlayground(envs)
    mock = MockRequestFactory(
        method=method, route=route, body_template=request_body_template
    )

    subtools = [
        tool
        for tools in (
            tool_factory(playground=playground, mock=mock)
            for tool_factory in [
                # create_filesystem_tools,
                # create_process_tools,
                create_code_tools,
            ]
        )
        for tool in tools
    ]
    return subtools, playground
