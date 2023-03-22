import datetime

import uuid
import asyncio
from asyncio import Queue, ensure_future
from typing import Coroutine, Dict, Any, List, Union
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.schema import AgentAction, AgentFinish, LLMResult
from pydantic import PrivateAttr

from codegen.agent.base import parse_action_string, separate_thought_and_action
from database import Database


class LogStreamParser:
    """
    To allow continuous streaming of partially finished logs we parse the logs every time we receive new token or tool output.
    We reparse only the tokens that corresponds to the buffered logs and not all the tokens that we have ever received.

    Buffered logs are partially finished logs that are either unfinished (still being streamed)
    or they are tools' logs for which we haven't received outputs yet.
    We can keep track of the buffered logs because there will always be more tool logs than tool outputs - we must parse the actions from tokens before they executed.
    Because of that all buffered logs can be flushed to finished logs when we receive output for the last tool in the buffered logs.

    We are matching the tools' logs and tools' outputs by the order in which they are parsed and ingested - if we need to support asynchronous execution of tools we need to change this matching.
    """

    def __init__(self) -> None:
        # All "finished" logs that the parser saved.
        self._logs: List[Dict[str, str]] = []

        self._token_buffer: str = ""

        # Logs have both `thought` logs and `tool` logs.
        # These logs can be partially parsed or they can have missing outputs.
        # They are flushed to self._logs after outputs for all tools in self._logs.buffer are ingested.
        self._logs_buffer: List[Dict[str, str]] = []

        # This is a list of tools' outputs that corresponds to the tool logs in the self._logs.buffer.
        self._tools_output_buffer: List[Dict[str, str]] = []
        # List of ids corresponding to the buffered logs.
        self._id_buffer: List[str] = []
        # List of timestamps corresponding to the buffered logs.
        self._start_timestamp_buffer: List[str] = []

    def _parse(self):
        """This function should be called only after ingesting new token or tool output to update the buffered logs."""
        thought, action_string = separate_thought_and_action(self._token_buffer)
        tools_logs = [
            {"type": "tool", "name": action.attrib["tool"], "input": action.text or ""}
            for action in parse_action_string(action_string)
        ]

        # Update tools' logs with the information from ingested tools' outputs.
        for i in range(len(self._tools_output_buffer)):
            tools_logs[i] = {
                **tools_logs[i],
                **self._tools_output_buffer[i],
            }

        # We overwrite the current buffered logs with their newer version.
        # If you ingested token or tool output this will save the change so you can call self.get_logs and get the new logs.
        self._logs_buffer = [
            {
                "type": "thought",
                "content": thought.removeprefix("Thought:")
                .replace("Action:", "")
                .strip(),
            },
            *tools_logs,
        ]

        # Add a new uuids to id buffer if we have less ids that there are logs in the logs buffer.
        self._id_buffer.extend(
            (
                str(uuid.uuid4())
                for _ in range(len(self._logs_buffer) - len(self._id_buffer))
            )
        )

        # Assign the stable ids to logs
        for log, id in zip(self._logs_buffer, self._id_buffer):
            log["id"] = id

        # Add a new timestamps to timestamps buffer if we have less timestamps that there are logs in the logs buffer.
        self._start_timestamp_buffer.extend(
            (
                str(datetime.datetime.now())
                for _ in range(
                    len(self._logs_buffer) - len(self._start_timestamp_buffer)
                )
            )
        )

        # Assign the corresponding timestamps to logs
        for log, timestamp in zip(self._logs_buffer, self._start_timestamp_buffer):
            log["created_at"] = timestamp

    def ingest_token(self, token: str):
        """Ingest token and update the logs."""
        self._token_buffer += token
        self._parse()
        return self

    def ingest_tool_output(self, output: str):
        """Ingest output from tool and update the logs."""
        self._tools_output_buffer.append(
            {
                "finish_at": str(datetime.datetime.now()),
                "output": output,
            }
        )
        self._parse()

        # If we received output for the last tool in the buffered logs we save the buffered logs to logs and reset all buffers.
        # We know this is is the output for the last tool if the number of tool logs in buffered logs is equal to the number of buffered outputs.
        if len(self._tools_output_buffer) == len(
            [log for log in self._logs_buffer if log["type"] == "tool"]
        ):
            self._logs.extend(self._logs_buffer)
            self._token_buffer = ""
            self._logs_buffer = []
            self._tools_output_buffer = []
            self._id_buffer = []

        return self

    def get_logs(self):
        return [
            *self._logs,
            *self._logs_buffer,
        ]


class LogQueue:
    def __init__(self) -> None:
        self.queue: Queue[Coroutine] = asyncio.Queue()
        self.work = ensure_future(self.worker())

    async def worker(self):
        while True:
            for _ in range(self.queue.qsize() - 1):
                old_coro = self.queue.get_nowait()
                try:
                    old_coro.close()
                except Exception as e:
                    print(e)

            task = await self.queue.get()
            try:
                await ensure_future(task)
                self.queue.task_done()
            except Exception as e:
                print(e)

    def close(self):
        self.work.cancel()


class LogsCallbackHandler(AsyncCallbackHandler):
    _database: Database = PrivateAttr()
    _run_id: str = PrivateAttr()
    _raw_logs: str = ""

    def __init__(self, database: Database, run_id: str, **kwargs: Any):
        super().__init__(**kwargs)
        self._database = database
        self._run_id = run_id
        self._parser = LogStreamParser()
        self._log_queue = LogQueue()

    def __del__(self):
        self._log_queue.close()

    def _push_raw_logs(self) -> None:
        if self._raw_logs:
            asyncio.ensure_future(
                self._database.push_raw_logs(self._run_id, self._raw_logs)
            )

    def _push_logs(self, logs: List[Dict[str, str]]) -> None:
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

        self._raw_logs += token
        self._push_raw_logs()

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
        self._raw_logs += "Starting tool..."
        self._push_raw_logs()

    async def on_tool_end(self, output: str, **kwargs: Any) -> None:
        """Run when tool ends running."""
        print("Finished tool")

        logs = self._parser.ingest_tool_output(output).get_logs()
        self._push_logs(logs)

        self._raw_logs += f"\n{output}\n"
        self._push_raw_logs()

    async def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        """Run on agent action."""
        pass

    async def on_tool_error(
        self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any
    ) -> None:
        """Run when tool errors."""
        print("Tool error", error)
        self._raw_logs += f"Tool error:\n{error}\n"
        self._push_raw_logs()

    async def on_text(self, text: str, **kwargs: Any) -> None:
        """Run on arbitrary text."""
        pass

    async def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> None:
        """Run on agent end."""
        pass
