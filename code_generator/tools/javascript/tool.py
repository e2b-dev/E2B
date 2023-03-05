"""A tool for running javascript code in eval() on remote endpoint"""

from langchain.tools.base import BaseTool


class JavascriptEval(BaseTool):
    name = "JavaScript Code Execution"
    description = (
        "JavaScript eval() function that can execute code. Use this to execute and evaluate javascript code. "
        "Input should be a valid javascript code. "
    )

    def _run(self, query: str) -> str:
        return 42
        # return eval(code)

    async def _arun(self, query: str) -> str:
        return NotImplementedError("JavascriptEval does not support async")
