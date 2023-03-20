from time import sleep
from langchain.callbacks.base import CallbackManager

from langchain.tools import BaseTool

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
    name = "AskHuman"
    description = "You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human."

    def __init__(self, callback_manager: CallbackManager, run_id: str):
        super().__init__(name=self.name, description=self.description, callback_manager=callback_manager)
        self.run_id = run_id

    def _run(self, question: str) -> str:
        # TODO: Save the question to DB (in logs? - should we still use callback manager)




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
