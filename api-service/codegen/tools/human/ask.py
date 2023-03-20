from langchain.callbacks.base import CallbackManager
from langchain.agents import Tool

from session.playground.base import Playground


def create_ask_human_tool(
    run_id: str, playground: Playground, callback_manager: CallbackManager
):
    def _run(question: str) -> str:
        print("Asking about")
        response = playground.api.wait_for_human_response(
            run_id=run_id,
        )
        print("HUMAN RESPONSE", response.response)
        return response.response

    tool = Tool(
        description="You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human.",
        name="AskHuman",
        func=_run,
    )

    tool.callback_manager = callback_manager

    return tool
