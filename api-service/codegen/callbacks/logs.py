from typing import Dict, Any, List, Union, Optional
import datetime
import uuid

from pydantic import PrivateAttr
from langchain.callbacks.base import BaseCallbackHandler
from langchain.schema import AgentAction, AgentFinish, LLMResult

from database import Database


class LogsCallbackHandler(BaseCallbackHandler):
    _logs: List[Dict[str, str]] = []
    _raw_logs: str = ""
    _current_action_id: Optional[str] = None
    _database: Database = PrivateAttr()
    _run_id: str = PrivateAttr()
    _file = open("out.txt", "w+")

    def __init__(self, database: Database, run_id: str, **kwargs: Any):
        super().__init__(**kwargs)
        self._database = database
        self._run_id = run_id

    def _push_raw_logs(self) -> None:
        if self._raw_logs:
            self._database.push_raw_logs(self._run_id, self._raw_logs)

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running."""
        pass

    def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
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

        # Update the correct action in the list with the new output
        action = next(a for a in self._logs if a["id"] == self._current_action_id)
        action["finish_at"] = str(datetime.datetime.now())
        action["output"] = output
        self._database.push_logs(
            run_id=self._run_id,
            logs=self._logs,
        )

    def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when tool errors."""
        print("Tool error", error)
        self._raw_logs += f"Tool error:\n{error}\n"
        self._push_raw_logs()

    def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Run on agent action."""
        self._current_action_id = str(uuid.uuid4())
        self._logs.append(
            {
                "id": self._current_action_id,
                "type": "tool",
                "name": action.tool,
                "input": action.tool_input,
                "start_at": str(datetime.datetime.now()),
                "finish_at": "",
                "output": "",
            }
        )
        self._database.push_logs(
            run_id=self._run_id,
            logs=self._logs,
        )

    def on_text(self, text: str, **kwargs: Any) -> None:
        """Run on arbitrary text."""
        pass

    def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> None:
        """Run on agent end."""
        pass
