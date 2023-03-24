from typing import Dict, Any, List, Union
from codegen.agent.base import ThoughtLog, ToolLog
from codegen.callbacks.log_queue import LogQueue
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema import AgentAction, AgentFinish, LLMResult
from pydantic import PrivateAttr

from codegen.callbacks.log_parser import LogStreamParser
from database import Database


class LogsCallbackHandler(AsyncCallbackHandler):
    _database: Database = PrivateAttr()
    _run_id: str = PrivateAttr()
    _raw_logs: str = ""

    def __init__(self, database: Database, run_id: str, tool_names: List[str], **kwargs: Any):
        super().__init__(**kwargs)
        self._database = database
        self._run_id = run_id
        self._parser = LogStreamParser(tool_names=tool_names)
        self._log_queue = LogQueue()
        self._raw_log_queue = LogQueue()

    def __del__(self):
        self._log_queue.close()
        self._raw_log_queue.close()

    def _add_and_push_raw_logs(self, new_raw_log: str) -> None:
        self._raw_logs += new_raw_log
        if self._raw_logs:
            coro = self._database.push_raw_logs(self._run_id, self._raw_logs)
            self._raw_log_queue.queue.put_nowait(coro)

    def _push_logs(self, logs: list[ToolLog | ThoughtLog]) -> None:
        coro = self._database.push_logs(self._run_id, logs)
        self._log_queue.queue.put_nowait(coro)

    async def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        """Run when LLM starts running."""
        pass

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Run on new LLM token. Only available when streaming is enabled."""
        logs = self._parser.ingest_token(token).get_logs()
        self._push_logs(logs)

        self._add_and_push_raw_logs(token)

    async def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        """Run when LLM ends running."""
        pass

    async def on_llm_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when LLM errors."""
        pass

    async def on_chain_start(
        self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any
    ) -> None:
        """Run when chain starts running."""
        pass

    async def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> None:
        """Run when chain ends running."""
        pass

    async def on_chain_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when chain errors."""
        pass

    async def on_tool_start(
        self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Run when tool starts running."""
        print("Starting tool")
        self._add_and_push_raw_logs("Starting tool...")

    async def on_tool_end(self, output: str, **kwargs: Any) -> None:
        """Run when tool ends running."""
        print("Finished tool")

        logs = self._parser.ingest_tool_output(output).get_logs()
        self._push_logs(logs)

        self._add_and_push_raw_logs(f"\n{output}\n")

    async def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Run on agent action."""
        pass

    async def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when tool errors."""
        print("Tool error", error)

        self._add_and_push_raw_logs(f"Tool error:\n{error}\n")

    async def on_text(self, text: str, **kwargs: Any) -> None:
        """Run on arbitrary text."""
        pass

    async def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> None:
        """Run on agent end."""
        pass
