from .base import PlaygroundBaseTool
from playground_client import NodeJSPlayground


class PlaygroundFilesystemTool(PlaygroundBaseTool):
    # name = "JavaScriptCodeExecution"
    # description = (
    #     "JavaScript eval() function that can execute code. Use this to execute and evaluate javascript code. "
    #     "Input should be a valid javascript code. "
    # )

    def __init__(self, playground: NodeJSPlayground) -> None:
        super().__init__(playground)

    def _run(self, command: str) -> str:
        self.playground.run_command(command)

    async def _arun(self, command: str) -> str:
        return NotImplementedError("JavascriptEval does not support async")
