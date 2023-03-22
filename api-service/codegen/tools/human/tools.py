from collections.abc import Generator
from typing import Any

from codegen.tools.async_tool import async_tool
from session.playground.base import Playground


def create_human_tools(
    run_id: str,
    playground: Playground,
    **kwargs,
) -> Generator[Any, None, None]:
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @async_tool("AskHuman")
    async def ask_human(question: str) -> str:
        """You can ask a human for guidance when you think you got stuck or you are not sure what to do next. The input should be a question for the human. Example usage:
        ```
        <action tool="Ask human">
        What should I do?
        <action/>
        ```"""
        print("Asking about")
        response = playground.api.wait_for_human_response(
            run_id=run_id,
        )
        print("HUMAN RESPONSE", response.response)
        return response.response

    # yield ask_human
