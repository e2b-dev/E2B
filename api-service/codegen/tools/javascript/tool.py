"""A tool for running javascript code in eval() on remote endpoint"""

from langchain.tools.base import BaseTool
from codegen.tools.javascript.eval import eval as js_eval


class JavascriptEvalTool(BaseTool):
    name = "JavaScriptCodeExecution"
    description = (
        "JavaScript eval() function that can execute code. Use this to execute and evaluate javascript code. "
        "Input should be a valid javascript code. "
    )

    def _run(self, query: str) -> str:
        query = query.strip().strip("`")
        return js_eval(query)

    async def _arun(self, query: str) -> str:
        return NotImplementedError("JavascriptEval does not support async")
