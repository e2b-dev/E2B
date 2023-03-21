from typing import Dict, Any, List, Union, Optional
import datetime
import uuid
from codegen.agent.base import parse_action_string


from pydantic import PrivateAttr
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import AgentAction, AgentFinish, LLMResult

from database import Database


class LogsCallbackHandler(BaseCallbackHandler):
    _database: Database = PrivateAttr()
    _run_id: str = PrivateAttr()

    _raw_logs: str = ""
    _token_buffer: str = ""
    _logs: List[Dict[str, str]] = []
    _active_logs: List[Dict[str, str]] = []
    _active_action_outputs: List[Dict[str, str]] = []

    def __init__(self, database: Database, run_id: str, **kwargs: Any):
        super().__init__(**kwargs)
        self._database = database
        self._run_id = run_id

    def _push_raw_logs(self) -> None:
        if self._raw_logs:
            pass
            # self._database.push_raw_logs(self._run_id, self._raw_logs)

    def _parse_token_buffer(self, token: str):
        self._token_buffer += token
        thought, *action_string = self._token_buffer.split("```")

        actions = (
            parse_action_string(action_string[0]) if len(action_string) > 0 else []
        )

        action_logs = [
            {"type": "tool", "name": action.attrib["tool"], "input": action.text or ""}
            for action in actions
        ]

        for i in range(len(self._active_action_outputs)):
            action_logs[i] = {
                **action_logs[i],
                **self._active_action_outputs[i],
            }

        self._active_logs = [
            {
                "type": "thought",
                "content": thought.removeprefix("Thought:")
                .replace("Action:", "")
                .strip(),
            },
            *action_logs,
        ]

        self._database.push_logs(
            run_id=self._run_id,
            logs=[
                *self._logs,
                *self._active_logs,
            ],
        )

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running."""
        pass

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
        self._parse_token_buffer(token)

        self._raw_logs += token
        self._push_raw_logs()

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Run when LLM ends running."""
        pass

    def on_llm_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when LLM errors."""
        pass

    def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Run when chain starts running."""
        pass

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        """Run when chain ends running."""
        pass

    def on_chain_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when chain errors."""
        pass

    def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Run when tool starts running."""
        print("Starting tool")
        self._raw_logs += "Starting tool..."
        self._push_raw_logs()

    def on_tool_end(self, output: str, **kwargs: Any) -> None:
        """Run when tool ends running."""
        print("Finished tool")

        self._raw_logs += f"\n{output}\n"
        self._push_raw_logs()

        self._active_action_outputs.append(
            {
                "finish_at": str(datetime.datetime.now()),
                "output": output,
            }
        )

        active_tools_logs = [log for log in self._active_logs if log["type"] == "tool"]

        if len(self._active_action_outputs) == len(active_tools_logs):
            self._parse_token_buffer("")

            self._logs.extend(self._active_logs)

            self._token_buffer = ""
            self._active_logs = []
            self._active_action_outputs = []

    def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Run on agent action."""

        # First parse the thought
        # The `action.log` should look like this:
        #
        # Thought: Lorem ipsum ...
        # Action:
        # ```
        # <action tool="$TOOL_NAME">
        # $INPUT
        # </action>
        # ```
        pass
        # thought, _ = action.log.split("Action:")
        # thought = thought.removeprefix("Thought:")
        # thought = thought.strip()
        # self._logs.append(
        #     {
        #         "id": str(uuid.uuid4()),
        #         "type": "thought",
        #         "content": thought,
        #         "created_at": str(datetime.datetime.now()),
        #     }
        # )

        # # We save the UUID for this action so we can later
        # # update this action with its output.
        # self._current_action_id = str(uuid.uuid4())
        # self._logs.append(
        #     {
        #         "id": self._current_action_id,
        #         "type": "tool",
        #         "name": action.tool,
        #         "input": action.tool_input,
        #         "start_at": str(datetime.datetime.now()),
        #         "finish_at": "",
        #         "output": "",
        #     }
        # )

        # self._database.push_logs(
        #     run_id=self._run_id,
        #     logs=self._logs,
        # )

    def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when tool errors."""
        print("Tool error", error)
        self._raw_logs += f"Tool error:\n{error}\n"
        self._push_raw_logs()

    def on_text(self, text: str, **kwargs: Any) -> None:
        """Run on arbitrary text."""
        pass

    def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> None:
        """Run on agent end."""
        pass
