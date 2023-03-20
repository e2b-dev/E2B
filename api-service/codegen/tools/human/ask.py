from langchain.tools import BaseTool
from session.playground.base import Playground


class AskHuman(BaseTool):
    run_id: str
    playground: Playground
    name = "AskHuman"
    description = "You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human."

    def _run(self, question: str) -> str:
        print("Asking about")
        response = self.playground.api.wait_for_human_response(
            run_id=self.run_id,
        )

        return response.response

    async def _arun(self, question: str) -> str:
        raise NotImplementedError("AskHuman does not support async")
