from typing import List
from langchain.tools.base import BaseTool
from playground_client import NodeJSPlayground

from .tools.filesystem import PlaygroundFilesystemTool
from .tools.dependencies import PlaygroundDependenciesTool
from .tools.process import PlaygroundProcessTool
from .tools.code import PlaygroundJavaScriptTool, PlaygroundTypeScriptTool

def create_playground_tools(playground: NodeJSPlayground) -> List[BaseTool]:
    return [
        PlaygroundTypeScriptTool(playground),
        PlaygroundJavaScriptTool(playground),
        PlaygroundFilesystemTool(playground),
        PlaygroundDependenciesTool(playground),
        PlaygroundProcessTool(playground),
    ]
