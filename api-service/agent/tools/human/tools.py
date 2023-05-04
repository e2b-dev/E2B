from collections.abc import Generator
from typing import Any

from agent.tools.async_tool import async_tool
from session.playground.base import Playground


def create_human_tools() -> Generator[Any, None, None]:
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @async_tool("LetHumanChoose")
    async def let_human_choose(options: str):
        """Let a human choose from one of the options. Sometimes there might be multiple viable paths forward. For example, when the human did not specify implementation details like a third party service, library, or an algorithm.
        Instead of you choosing the path forward, use this tool to present up to 5 best options forward for the human to choose from.
        The input should be a question for the human and possible options. Provide a 1-3 sentence long summary for each option. Example usage:
        <action tool="LetHumanChoose">
        <question>A question asking the human for the path forward</question>
        <option>Option A and the reason why it might be a good idea</option>
        <option>Option B and the reason why it might be a good idea</option>
        </action>
        """
        print("+++ OPTIONS")
        print(options)
        print("--- OPTIONS")

        # TODO: Handle ask human via the WS/interaction request API
        pass

    # yield let_human_choose

    @async_tool("AskHuman")
    async def ask_human(question: str):
        """You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question."""
        # TODO: Handle ask human via the WS/interaction request API
        pass

    # yield ask_human
