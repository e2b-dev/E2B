from langchain.tools.base import BaseTool


class ReadDocumentation(BaseTool):
    name = "Read Documentation"
    description = (
        "Read quickstart documentation of a third party library or package."
        "The library or package must be hosted on GitHub and publicly accessible."
        "Input must be a link to a public GitHub repository where the library or the package is hosted."
    )

    def _run(self, query: str) -> str:
        f = open(
            "/Users/vasekmlejnsky/Developer/ai-api/api-service/codegen/tools/documentation/readme.md",
            "r",
        )
        return f.read()

    async def _arun(self, query: str) -> str:
        return NotImplementedError("ReadDocumentation does not support async")
