from langchain.tools.base import BaseTool
from playground_client.playground import NodeJSPlayground

class PlaygroundBaseTool(BaseTool):
    def __init__(self, playground: NodeJSPlayground) -> None:
        super().__init__()
        self.playground = playground

    @staticmethod
    def extract_escaped_query(query: str):
        raise NotImplementedError('Not implemented')
