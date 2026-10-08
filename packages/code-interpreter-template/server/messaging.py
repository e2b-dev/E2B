import datetime
import json
import logging
import uuid
import asyncio

import httpx

from asyncio import Queue
from typing import (
    Dict,
    Optional,
    Union,
)
from pydantic import StrictStr
from websockets.client import WebSocketClientProtocol, unix_connect
from websockets.exceptions import (
    ConnectionClosedError,
    WebSocketException,
)

from api.models.error import Error
from api.models.logs import Stdout, Stderr
from api.models.result import Result
from api.models.output import (
    EndOfExecution,
    NumberOfExecutions,
    OutputType,
    UnexpectedEndOfExecution,
)
from consts import JUPYTER_BASE_URL, JUPYTER_SOCKET_PATH
from errors import ExecutionError
from envs import get_envs

logger = logging.getLogger(__name__)

MAX_RECONNECT_RETRIES = 3
PING_TIMEOUT = 30
KEEPALIVE_INTERVAL = 5  # seconds between keepalive pings during streaming


class Execution:
    def __init__(self, in_background: bool = False):
        self.queue = Queue[
            Union[
                Result,
                Error,
                Stdout,
                Stderr,
                EndOfExecution,
                NumberOfExecutions,
                UnexpectedEndOfExecution,
            ]
        ]()
        self.input_accepted = False
        self.errored = False
        self.in_background = in_background


class ContextWebSocket:
    _ws: Optional[WebSocketClientProtocol] = None
    _receive_task: Optional[asyncio.Task] = None
    _global_env_vars: Optional[Dict[StrictStr, str]] = None
    _cleanup_task: Optional[asyncio.Task] = None

    def __init__(self, context_id: str, session_id: str, language: str, cwd: str):
        self.language = language
        self.cwd = cwd
        self.context_id = context_id
        self.url = f"ws://localhost/api/kernels/{context_id}/channels"
        self.session_id = session_id
        self._executions: Dict[str, Execution] = {}
        self._lock = asyncio.Lock()

    async def reconnect(self):
        if self._ws is not None:
            await self._ws.close(reason="Reconnecting")

        if self._receive_task is not None:
            await self._receive_task

        await self.connect()

    async def connect(self):
        logger.debug(f"WebSocket connecting to {self.url}")

        ws_logger = logger.getChild("websockets.client")
        ws_logger.setLevel(logging.ERROR)

        self._ws = await unix_connect(
            JUPYTER_SOCKET_PATH,
            uri=self.url,
            ping_timeout=PING_TIMEOUT,
            max_size=None,
            max_queue=None,
            logger=ws_logger,
        )

        logger.info(f"WebSocket connected to {self.url}")
        self._receive_task = asyncio.create_task(
            self._receive_message(),
            name="receive_message",
        )

    async def interrupt(self):
        """Interrupt the current kernel execution via the Jupyter REST API."""
        try:
            async with httpx.AsyncClient(
                transport=httpx.AsyncHTTPTransport(uds=JUPYTER_SOCKET_PATH),
                trust_env=False,
            ) as client:
                response = await client.post(
                    f"{JUPYTER_BASE_URL}/api/kernels/{self.context_id}/interrupt"
                )
                if response.is_success:
                    logger.info(f"Kernel {self.context_id} interrupted successfully")
                else:
                    logger.error(
                        f"Failed to interrupt kernel {self.context_id}: {response.status_code}"
                    )
        except Exception as e:
            logger.error(f"Error interrupting kernel {self.context_id}: {e}")

    def _get_execute_request(
        self, msg_id: str, code: Union[str, StrictStr], background: bool
    ) -> str:
        return json.dumps(
            {
                "header": {
                    "msg_id": msg_id,
                    "username": "e2b",
                    "session": self.session_id,
                    "msg_type": "execute_request",
                    "version": "5.3",
                    "date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                },
                "parent_header": {},
                "metadata": {
                    "trusted": True,
                    "deletedCells": [],
                    "recordTiming": False,
                    "cellId": str(uuid.uuid4()),
                },
                "content": {
                    "code": code,
                    "silent": background,
                    "store_history": True,
                    "user_expressions": {},
                    "stop_on_error": True,
                    "allow_stdin": False,
                },
            }
        )

    def _set_env_var_snippet(self, key: str, value: str) -> str:
        """Get environment variable set command for the current language."""
        if self.language == "python":
            return f"import os; os.environ['{key}'] = '{value}'"
        elif self.language in ["javascript", "typescript"]:
            return f"process.env['{key}'] = '{value}'"
        elif self.language == "r":
            return f'Sys.setenv({key} = "{value}")'
        elif self.language == "java":
            return f'System.setProperty("{key}", "{value}");'
        elif self.language == "bash":
            return f"export {key}='{value}'"
        return ""

    def _delete_env_var_snippet(self, key: str) -> str:
        """Get environment variable delete command for the current language."""
        if self.language == "python":
            return f"import os; del os.environ['{key}']"
        elif self.language in ["javascript", "typescript"]:
            return f"delete process.env['{key}']"
        elif self.language == "r":
            return f"Sys.unsetenv('{key}')"
        elif self.language == "java":
            return f'System.clearProperty("{key}");'
        elif self.language == "bash":
            return f"unset {key}"
        return ""

    def _set_env_vars_code(self, env_vars: Dict[StrictStr, str]) -> str:
        """Build environment variable code for the current language."""
        env_commands = []
        for k, v in env_vars.items():
            command = self._set_env_var_snippet(k, v)
            if command:
                env_commands.append(command)

        return "\n".join(env_commands)

    def _reset_env_vars_code(self, env_vars: Dict[StrictStr, str]) -> str:
        """Build environment variable cleanup code for the current language."""
        cleanup_commands = []

        for key in env_vars:
            # Check if this var exists in global env vars
            if self._global_env_vars and key in self._global_env_vars:
                # Reset to global value
                value = self._global_env_vars[key]
                command = self._set_env_var_snippet(key, value)
            else:
                # Remove the variable
                command = self._delete_env_var_snippet(key)

            if command:
                cleanup_commands.append(command)

        return "\n".join(cleanup_commands)

    def _get_code_indentation(self, code: str) -> str:
        """Get the indentation from the first non-empty line of code."""
        if not code or not code.strip():
            return ""

        lines = code.split("\n")
        for line in lines:
            if line.strip():  # First non-empty line
                return line[: len(line) - len(line.lstrip())]

        return ""

    def _indent_code_with_level(self, code: str, indent_level: str) -> str:
        """Apply the given indentation level to each line of code."""
        if not code or not indent_level:
            return code

        lines = code.split("\n")
        indented_lines = []

        for line in lines:
            if line.strip():  # Non-empty lines
                indented_lines.append(indent_level + line)
            else:
                indented_lines.append(line)

        return "\n".join(indented_lines)

    async def _cleanup_env_vars(self, env_vars: Dict[StrictStr, str]):
        """Clean up environment variables in a separate execution request."""
        message_id = str(uuid.uuid4())
        self._executions[message_id] = Execution(in_background=True)

        try:
            cleanup_code = self._reset_env_vars_code(env_vars)
            if cleanup_code:
                logger.info(f"Cleaning up env vars: {cleanup_code}")
                request = self._get_execute_request(message_id, cleanup_code, True)
                await self._ws.send(request)

                async for item in self._wait_for_result(message_id):
                    if item["type"] == "error":
                        logger.error(f"Error during env var cleanup: {item}")
        finally:
            del self._executions[message_id]

    async def _wait_for_result(self, message_id: str):
        queue = self._executions[message_id].queue

        # Use a timeout on queue.get() to periodically send keepalives.
        # Without keepalives, the generator blocks indefinitely waiting for
        # kernel output. If the client silently disappears (e.g. network
        # failure), uvicorn can only detect the broken connection when it
        # tries to write — so we force a write every KEEPALIVE_INTERVAL
        # seconds. This ensures timely disconnect detection and kernel
        # interrupt for abandoned executions (see #213).
        while True:
            try:
                output = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_INTERVAL)
            except asyncio.TimeoutError:
                # Yield a keepalive so Starlette writes to the socket.
                # If the client has disconnected, the write fails and
                # uvicorn delivers http.disconnect, which cancels this
                # generator via CancelledError.
                yield {"type": "keepalive"}
                continue

            if output.type == OutputType.END_OF_EXECUTION:
                break

            if output.type == OutputType.UNEXPECTED_END_OF_EXECUTION:
                logger.error(f"Unexpected end of execution for code ({message_id})")
                yield Error(
                    name="UnexpectedEndOfExecution",
                    value="Connection to the execution was closed before the execution was finished",
                    traceback="",
                )
                break

            yield output.model_dump(exclude_none=True)

    async def change_current_directory(
        self, path: Union[str, StrictStr], language: str
    ):
        message_id = str(uuid.uuid4())
        self._executions[message_id] = Execution(in_background=True)
        if language == "python":
            request = self._get_execute_request(message_id, f"%cd {path}", True)
        elif language in ("javascript", "typescript"):
            request = self._get_execute_request(
                message_id, f"process.chdir('{path}')", True
            )
        elif language == "r":
            request = self._get_execute_request(message_id, f"setwd('{path}')", True)
        # This does not actually change the working directory, but sets the user.dir property
        elif language == "java":
            request = self._get_execute_request(
                message_id, f'System.setProperty("user.dir", "{path}");', True
            )
        elif language == "bash":
            request = self._get_execute_request(message_id, f"cd '{path}'", True)
        else:
            return

        await self._ws.send(request)

        async for item in self._wait_for_result(message_id):
            if item["type"] == "error":
                raise ExecutionError(f"Error during execution: {item}")

    async def execute(
        self,
        code: Union[str, StrictStr],
        env_vars: Dict[StrictStr, str],
        access_token: str,
    ):
        if self._ws is None:
            raise Exception("WebSocket not connected")

        async with self._lock:
            # Wait for any pending cleanup task to complete
            if self._cleanup_task and not self._cleanup_task.done():
                logger.debug("Waiting for pending cleanup task to complete")
                try:
                    await self._cleanup_task
                except Exception as e:
                    logger.warning(f"Cleanup task failed: {e}")
                finally:
                    self._cleanup_task = None

            # Get the indentation level from the code
            code_indent = self._get_code_indentation(code)

            # Build the complete code snippet with env vars
            complete_code = code

            global_env_vars_snippet = ""
            env_vars_snippet = ""

            if self._global_env_vars is None:
                self._global_env_vars = await get_envs(access_token=access_token)
                global_env_vars_snippet = self._set_env_vars_code(self._global_env_vars)

            if env_vars:
                env_vars_snippet = self._set_env_vars_code(env_vars)

            if global_env_vars_snippet or env_vars_snippet:
                indented_env_code = self._indent_code_with_level(
                    f"{global_env_vars_snippet}\n{env_vars_snippet}", code_indent
                )
                complete_code = f"{indented_env_code}\n{complete_code}"

            message_id = str(uuid.uuid4())
            execution = Execution()
            self._executions[message_id] = execution

            # Send the code for execution
            # Initial request and retries
            for i in range(1 + MAX_RECONNECT_RETRIES):
                try:
                    logger.info(
                        f"Sending code for the execution ({message_id}): {complete_code}"
                    )
                    request = self._get_execute_request(
                        message_id, complete_code, False
                    )
                    await self._ws.send(request)
                    break
                except (ConnectionClosedError, WebSocketException) as e:
                    # Keep the last result, even if error
                    if i < MAX_RECONNECT_RETRIES:
                        logger.warning(
                            f"WebSocket connection lost while sending execution request, {i + 1}. reconnecting...: {str(e)}"
                        )
                        await self.reconnect()
            else:
                # The retry didn't help, request wasn't sent successfully
                logger.error("Failed to send execution request")
                await execution.queue.put(
                    Error(
                        name="WebSocketError",
                        value="Failed to send execution request",
                        traceback="",
                    )
                )
                await execution.queue.put(UnexpectedEndOfExecution())

            # Stream the results.
            # If the client disconnects (Starlette cancels the task), we
            # interrupt the kernel so the next execution isn't blocked (#213).
            try:
                async for item in self._wait_for_result(message_id):
                    yield item
            except (asyncio.CancelledError, GeneratorExit):
                logger.warning(
                    f"Client disconnected during execution ({message_id}), interrupting kernel"
                )
                # Shield the interrupt from the ongoing cancellation so
                # the HTTP request to the kernel actually completes.
                try:
                    await asyncio.shield(self.interrupt())
                except asyncio.CancelledError:
                    pass
                raise
            finally:
                if message_id in self._executions:
                    del self._executions[message_id]

            # Clean up env vars in a separate request after the main code has run
            if env_vars:
                self._cleanup_task = asyncio.create_task(
                    self._cleanup_env_vars(env_vars)
                )

    async def _receive_message(self):
        if not self._ws:
            logger.error("No WebSocket connection")
            return

        try:
            async for message in self._ws:
                await self._process_message(json.loads(message))
        except Exception as e:
            logger.error(f"WebSocket received error while receiving messages: {str(e)}")
        finally:
            # To prevent infinite hang, we need to cancel all ongoing execution as we could lost results during the reconnect
            # Thanks to the locking, there can be either no ongoing execution or just one.
            for key, execution in self._executions.items():
                await execution.queue.put(
                    Error(
                        name="WebSocketError",
                        value="The connections was lost, rerun the code to get the results",
                        traceback="",
                    )
                )
                await execution.queue.put(UnexpectedEndOfExecution())

    async def _process_message(self, data: dict):
        """
        Process messages from the WebSocket

        Message types:
        https://jupyter-client.readthedocs.io/en/stable/messaging.html

        :param data: The message data
        """
        if (
            data["msg_type"] == "status"
            and data["content"]["execution_state"] == "restarting"
        ):
            logger.error("Context is restarting")
            for execution in self._executions.values():
                await execution.queue.put(
                    Error(
                        name="ContextRestarting",
                        value="Context was restarted",
                        traceback="",
                    )
                )
                await execution.queue.put(EndOfExecution())
            return

        parent_msg_ig = data["parent_header"].get("msg_id", None)
        if parent_msg_ig is None:
            logger.warning("Parent message ID not found. %s", data)
            return

        execution = self._executions.get(parent_msg_ig)
        if not execution:
            return

        queue = execution.queue
        if data["msg_type"] == "error":
            logger.debug(
                f"Execution {parent_msg_ig} finished execution with error: {data['content']['ename']}: {data['content']['evalue']}"
            )

            if execution.errored:
                return

            execution.errored = True
            await queue.put(
                Error(
                    name=data["content"]["ename"],
                    value=data["content"]["evalue"],
                    traceback="".join(data["content"]["traceback"]),
                )
            )

        elif data["msg_type"] == "stream":
            if data["content"]["name"] == "stdout":
                logger.debug(
                    f"Execution {parent_msg_ig} received stdout: {data['content']['text']}"
                )
                await queue.put(
                    Stdout(
                        text=data["content"]["text"], timestamp=data["header"]["date"]
                    )
                )

            elif data["content"]["name"] == "stderr":
                logger.debug(
                    f"Execution {parent_msg_ig} received stderr: {data['content']['text']}"
                )
                await queue.put(
                    Stderr(
                        text=data["content"]["text"], timestamp=data["header"]["date"]
                    )
                )

        elif data["msg_type"] in "display_data":
            result = Result(is_main_result=False, data=data["content"]["data"])
            logger.debug(
                f"Execution {parent_msg_ig} received display data with following formats: {result.formats()}"
            )
            await queue.put(result)

        elif data["msg_type"] == "execute_result":
            result = Result(is_main_result=True, data=data["content"]["data"])
            logger.debug(
                f"Execution {parent_msg_ig} received execution result with following formats: {result.formats()}"
            )
            await queue.put(result)

        elif data["msg_type"] == "status":
            if data["content"]["execution_state"] == "busy" and execution.in_background:
                logger.debug(f"Execution {parent_msg_ig} started execution")
                execution.input_accepted = True

            if data["content"]["execution_state"] == "idle":
                if execution.input_accepted:
                    logger.debug(f"Execution {parent_msg_ig} finished execution")
                    await queue.put(EndOfExecution())

            elif data["content"]["execution_state"] == "error":
                logger.debug(f"Execution {parent_msg_ig} finished execution with error")
                await queue.put(
                    Error(
                        name=data["content"]["ename"],
                        value=data["content"]["evalue"],
                        traceback="".join(data["content"]["traceback"]),
                    )
                )
                await queue.put(EndOfExecution())

        elif data["msg_type"] == "execute_reply":
            if data["content"]["status"] == "error":
                logger.debug(f"Execution {parent_msg_ig} finished execution with error")

                if execution.errored:
                    return

                execution.errored = True
                await queue.put(
                    Error(
                        name=data["content"].get("ename", ""),
                        value=data["content"].get("evalue", ""),
                        traceback="".join(data["content"].get("traceback", [])),
                    )
                )
            elif data["content"]["status"] == "abort":
                logger.debug(f"Execution {parent_msg_ig} was aborted")
                await queue.put(
                    Error(
                        name="ExecutionAborted",
                        value="Execution was aborted",
                        traceback="",
                    )
                )
                await queue.put(EndOfExecution())
            elif data["content"]["status"] == "ok":
                pass

        elif data["msg_type"] == "execute_input":
            logger.debug(f"Input accepted for {parent_msg_ig}")
            await queue.put(
                NumberOfExecutions(execution_count=data["content"]["execution_count"])
            )
            execution.input_accepted = True
        else:
            logger.warning(f"[UNHANDLED MESSAGE TYPE]: {data['msg_type']}")

    async def close(self):
        logger.debug(f"Closing WebSocket {self.context_id}")

        if self._ws is not None:
            await self._ws.close()

        if self._receive_task is not None:
            self._receive_task.cancel()

        # Cancel any pending cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        for execution in self._executions.values():
            execution.queue.put_nowait(UnexpectedEndOfExecution())
