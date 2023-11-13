import json

from typing import (
    List,
    TYPE_CHECKING,
)

from e2b.sandbox.main import Sandbox

if TYPE_CHECKING:
    from openai.types.beta.threads.run_submit_tool_outputs_params import ToolOutput
    from openai.types.beta.threads.run import Run


class Assistant:
    def __init__(self, sandbox: "Sandbox"):
        self._sandbox = sandbox

    def run(self, run: "Run") -> List["ToolOutput"]:
        if run.status != "requires_action":
            return []

        if not run.required_action:
            return []

        outputs = []

        for tool_call in run.required_action.submit_tool_outputs.tool_calls:
            action = self._sandbox._actions.get(tool_call.function.name)
            if not action:
                continue

            args = json.loads(tool_call.function.arguments)
            output = action(self._sandbox, args)

            outputs.append(
                {
                    "tool_call_id": tool_call.id,
                    "output": output,
                }
            )

        return outputs


class OpenAI:
    def __init__(self, assistant: Assistant):
        self._assistant = assistant

    @property
    def assistant(self):
        return self._assistant
