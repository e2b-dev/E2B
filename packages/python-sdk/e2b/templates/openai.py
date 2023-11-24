import json
import logging

from typing import (
    Generic,
    List,
    TYPE_CHECKING,
    TypeVar,
)

from e2b.sandbox.main import Sandbox

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from openai.types.beta.threads.run_submit_tool_outputs_params import ToolOutput
    from openai.types.chat.chat_completion_message_tool_call import (
        ChatCompletionMessageToolCall,
    )
    from openai.types.chat.chat_completion_tool_message_param import (
        ChatCompletionToolMessageParam,
    )
    from openai.types.beta.threads.run import Run


S = TypeVar(
    "S",
    bound=Sandbox,
)


class Actions(Generic[S]):
    def __init__(self, sandbox: S):
        self._sandbox = sandbox

    def run(self, run: "Run") -> List["ToolOutput"]:
        """
        Call the required actions for the provided run and return their outputs.

        :param run: OpenAI run object from `openai.beta.threads.runs.retrieve` or `openai.beta.threads.runs.retrieve.create` call that contains the names of the required actions and their arguments.

        :return: The outputs of the required actions in the run.
        """
        if run.status != "requires_action":
            return []

        if not run.required_action:
            return []

        outputs: List["ToolOutput"] = []

        for tool_call in run.required_action.submit_tool_outputs.tool_calls:
            args = json.loads(tool_call.function.arguments)
            output = self._sandbox.call_action(tool_call.function.name, args)

            if output is None:
                continue

            outputs.append(
                ToolOutput(
                    tool_call_id=tool_call.id,
                    output=output,
                )
            )

        return outputs


class Completions(Generic[S]):
    def __init__(self, sandbox: S):
        self._sandbox = sandbox

    def run(
        self, tool_calls: List["ChatCompletionMessageToolCall"]
    ) -> List["ChatCompletionToolMessageParam"]:
        if not tool_calls:
            return []

        outputs: List["ChatCompletionToolMessageParam"] = []

        for tool_call in tool_calls:
            args = json.loads(tool_call.function.arguments)
            output = self._sandbox.call_action(tool_call.function.name, args)

            if output is None:
                continue

            outputs.append(
                ChatCompletionToolMessageParam(
                    tool_call_id=tool_call.id,
                    role="tool",
                    content=output,
                )
            )

        return outputs


class OpenAI(Generic[S]):
    def __init__(self, actions: Actions[S]):
        self._actions = actions

    @property
    def actions(self):
        return self._actions

    @property
    def completions(self):
        return self._actions
