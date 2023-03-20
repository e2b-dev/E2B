from time import sleep

from langchain.callbacks.base import CallbackManager
from langchain.tools import BaseTool
from session.playground.base import Playground

from session.session import Session

# {
#     "id": "52b2b157-132f-47c6-be1e-3c203034fdfb",
#     "name": "InstallNPMDependencies",
#     "type": "tool",
#     "input": "\nexpress\n",
#     "output": "All dependencies installed",
#     "start_at": "2023-03-19 23:49:23.079327",
#     "finish_at": "2023-03-19 23:49:26.002323"
# },


class AskHuman(BaseTool):
    run_id: str
    route_id: str
    project_id: str
    playground: Playground
    name = "AskHuman"
    description = "You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human."

    def _run(self, question: str) -> str:
        # TODO: Save the question to DB (in logs? - should we still use callback manager)

        print("Asking about")
        response = self.playground.api.wait_for_human_response(
            run_id=self.run_id,
            project_id=self.project_id,
            route_id=self.route_id,
        )

        return response.response

        # TODO: Wait until the question is answered -> timeout?
        # TODO: Parse and return the correct output from the logs

        # print(question)
        # sleep(60)
        # with open(
        #     "/Users/vasekmlejnsky/Developer/ai-api/api-service/codegen/human_input.txt"
        # ) as f:
        #     human_input = f.read()
        # print("human_input:", human_input)
        # return human_input

    async def _arun(self, question: str) -> str:
        raise NotImplementedError("AskHuman does not support async")
