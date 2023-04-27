import datetime
import uuid

from typing import List, TypedDict

from agent.output.parse_output import (
    Log,
    ThoughtLog,
    ToolLog,
    merge_logs,
    parse_output,
)


class Step(TypedDict):
    output: str
    logs: List[ToolLog | ThoughtLog]


class ToolOutput(TypedDict):
    finish_at: str
    tool_output: str


class LogMeta(TypedDict):
    id: str
    created_at: str


class OutputStreamParser:
    """
    We receive a stream of tokens and want to parse this stream of tokens to thought and tool logs
    even if we haven't yet received all tokens we need to execute the action.

    We call the self._parse every time we receive new token or tool output.
    This method takes the token buffer and tries to transform it to thought and tool logs.
    It can also create tool logs even if we haven't received all the tokens we need to execute the action yet.

    // Example token buffer content:
    Thought:
    This is a thought

    Action:
    <action type="CurlJavaScriptServer">
    </ac
    // End of example

    This is parsed as following buffered logs:
    [
        {
            "id": "id1",
            "created_at": "2023-03-22 13:46:52.561854",
            "type": "thought",
            "content": "This is a thought",
        },
        {
            "id": "id2",
            "created_at": "2023-03-22 13:46:52.561854",
            "type": "tool",
            "tool_name": "CurlJavaScriptServer,
            "tool_input": "",
        }
    ]

    Buffered logs are thought logs or tool logs for which we haven't received outputs yet.

    We can keep track of the buffered logs because there will always be more tool logs than tool outputs - we must parse the actions from tokens before they executed.
    We are matching the tools' logs and tools' outputs by the order in which they are parsed and ingested (if we need to support asynchronous execution of tools we need to change this matching)
    and the buffered can be flushed to finished logs when we receive output for the last tool in the buffered logs.
    """

    def __init__(
        self,
        tool_names: List[str],
        steps: List[Step] = [],
        buffered_step: Step = Step(output="", logs=[]),
    ) -> None:
        self._tool_names = tool_names

        # All "finished" logs that the parser saved.
        self._steps = steps

        self._token_buffer: str = buffered_step["output"]

        # Logs have both `thought` logs and `tool` logs.
        # These logs can be partially parsed or they can have missing outputs.
        # They are flushed to self._logs after outputs for all tools in self._logs.buffer are ingested.
        self._logs_buffer: List[ToolLog | ThoughtLog] = buffered_step["logs"]
        self._logs_meta_buffer: List[LogMeta] = [
            LogMeta(created_at=log.get("created_at", ""), id=log.get("id", ""))
            for log in self._logs_buffer
        ]

        # This is a list of tools' outputs that corresponds to the tool logs in the self._logs.buffer.
        self._tools_output_buffer: List[ToolOutput] = [
            ToolOutput(
                finish_at=log.get("finish_at", ""),
                tool_output=log.get("tool_output", ""),
            )
            for log in self._logs_buffer
            if log.get("tool_output")
        ]

    def _parse(self):
        """This function should be called only after ingesting new token or tool output to update the buffered logs."""
        # We overwrite the current buffered logs with their newer version.
        # If you ingested token or tool output this will save the change so you can call self.get_logs and get the new logs.
        self._logs_buffer = [
            log
            for log in parse_output(self._token_buffer)
            if log["type"] == "thought"
            or log["type"] == "tool"
            and log.get("tool_name") in self._tool_names
        ]

        # Add a new uuids to id buffer if we have less ids that there are logs in the logs buffer.
        self._logs_meta_buffer.extend(
            LogMeta(id=str(uuid.uuid4()), created_at=str(datetime.datetime.now()))
            for _ in range(len(self._logs_buffer) - len(self._logs_meta_buffer))
        )

        # Assign the stable ids and timestamps to logs
        for log, meta in zip(self._logs_buffer, self._logs_meta_buffer):
            merge_logs(log, meta)

        # Update tools' logs with the information from ingested tools' outputs.
        for tool_log, output in zip(
            (tool_log for tool_log in self._logs_buffer if tool_log["type"] == "tool"),
            self._tools_output_buffer,
        ):
            merge_logs(tool_log, output)

    def ingest_complete_llm_output(self, output: str):
        """Ingest whole output of an LLM overwriting the current buffer."""
        self._token_buffer = output
        self._parse()
        return self

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
                "tool_output": output,
            }
        )
        self._parse()

        # If we received output for the last tool in the buffered logs we save the buffered logs to logs and reset all buffers.
        # We know this is is the output for the last tool if the number of tool logs in buffered logs is equal to the number of buffered outputs.
        if len(self._tools_output_buffer) == len(
            [log for log in self._logs_buffer if log["type"] == "tool"]
        ):
            self._steps.append(self.get_current_step())
            self._token_buffer = ""
            self._logs_buffer = []
            self._tools_output_buffer = []
            self._logs_meta_buffer = []

        return self

    def get_steps(self) -> List[Step]:
        return [*self._steps, self.get_current_step()]

    def get_current_step(self):
        return Step(output=self._token_buffer, logs=self._logs_buffer)
