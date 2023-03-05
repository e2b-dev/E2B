"""A tool for running javascript code in eval() on remote endpoint"""

from langchain.tools.base import BaseTool

from code_generator.tools.javascript.eval import eval as js_eval


class JavascriptEvalTool(BaseTool):
    name = "JavaScript Code Execution"
    description = (
        "JavaScript eval() function that can execute code. Use this to execute and evaluate javascript code. "
        "Input should be a valid javascript code. "
    )

    def _run(self, query: str) -> str:
        query = query.strip().strip('`')
        print("=== Query ===")
        print(query)
        print("========")
        return js_eval(query)

    async def _arun(self, query: str) -> str:
        return NotImplementedError("JavascriptEval does not support async")
