"""
Run [Agent Client Protocol](https://agentclientprotocol.com) agents in E2B sandboxes.
"""

import contextlib
from typing import Callable, Dict, Optional, Tuple, Union, cast

import acp
from acp.core import ClientSideConnection
from e2b import AsyncSandbox
from e2b.connection_config import Username

from .consts import DEFAULT_MAX_MESSAGE_BYTES, DEFAULT_STOP_TIMEOUT
from .exceptions import ACPException
from .transport import ACPTransport
from .types import ACPAgentResult, StderrHandler


class AsyncACPAgent:
    """
    ACP agent running in a sandbox, connected to your client.
    """

    def __init__(
        self,
        sandbox: AsyncSandbox,
        command: str,
        client: Union[acp.Client, Callable[[acp.Agent], acp.Client]],
        *,
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[Username] = None,
        on_stderr: Optional[StderrHandler] = None,
        max_message_bytes: int = DEFAULT_MAX_MESSAGE_BYTES,
        request_timeout: Optional[float] = None,
    ):
        """
        Create an ACP agent for the sandbox. Call `start()` to run it and
        connect your ACP client to it over the agent's stdin/stdout.

        The client filesystem and terminal capabilities are turned off in
        `initialize`, and agent requests for `fs/*` or `terminal/*` are answered
        with an error without reaching your client, so the agent edits files and
        runs commands with its own tools in the sandbox. Network access and MCP
        servers you pass to the agent are not restricted.

        ```python
        import acp
        from e2b import AsyncSandbox
        from e2b_acp import AsyncACPAgent

        sandbox = await AsyncSandbox.create("goose")
        agent = AsyncACPAgent(sandbox, "goose acp", client)
        await agent.start()
        await agent.connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
        # ...
        await agent.stop()
        ```

        :param sandbox: Sandbox with the agent installed
        :param command: Command that starts the agent in ACP mode, for example `goose acp`
        :param client: Your ACP client instance, or a function that takes the agent connection and returns one. It answers permission requests and receives the agent's session updates
        :param cwd: Working directory of the agent
        :param envs: Environment variables for the agent
        :param user: User to run the agent as
        :param on_stderr: Callback for the agent's stderr output (logs). The agent's stdout is reserved for the protocol
        :param max_message_bytes: Maximum size of a single message from the agent in **bytes**; defaults to ``DEFAULT_MAX_MESSAGE_BYTES`` (32 MiB)
        :param request_timeout: Timeout for starting the agent in **seconds**
        """
        self._sandbox = sandbox
        self._command = command
        self._client = client
        self._cwd = cwd
        self._envs = envs
        self._user = user
        self._on_stderr = on_stderr
        self._max_message_bytes = max_message_bytes
        self._request_timeout = request_timeout
        self._started = False
        self._transport: Optional[ACPTransport] = None
        self._connection: Optional[ClientSideConnection] = None

    async def start(self) -> None:
        """
        Start the agent in the sandbox and connect your ACP client to it.

        :raises InvalidArgumentException: If `max_message_bytes` is not a positive integer
        :raises SandboxException: If the agent could not be started. Later, the
            connection fails with an `ACPException` if the agent exits with a
            non-zero code or sends a message over `max_message_bytes`
        :raises RuntimeError: If `start()` was already called
        """
        if self._started:
            raise RuntimeError("ACP agent was already started")
        self._started = True
        transport = ACPTransport(
            self._sandbox, self._max_message_bytes, self._on_stderr
        )
        await transport.start(
            self._command, self._envs, self._user, self._cwd, self._request_timeout
        )
        try:
            # connect_to_agent passes a factory on to ClientSideConnection, which
            # accepts it, but annotates `client` as a client only.
            self._connection = acp.connect_to_agent(
                cast(acp.Client, self._client), transport
            )
        except BaseException:
            with contextlib.suppress(Exception):
                await transport.kill()
            raise
        self._transport = transport

    def _running(self) -> Tuple[ACPTransport, ClientSideConnection]:
        if self._transport is None or self._connection is None:
            raise RuntimeError("ACP agent is not started, call start() first")
        return self._transport, self._connection

    @property
    def connection(self) -> ClientSideConnection:
        """
        Connection to the agent. Use it to initialize, create sessions and send prompts.
        """
        return self._running()[1]

    @property
    def pid(self) -> int:
        """
        Process ID of the agent in the sandbox.
        """
        return self._running()[0].pid

    async def wait(self) -> ACPAgentResult:
        """
        Wait for the agent process to exit.

        A non-zero exit is returned, not raised. If the agent's output stream
        failed before the exit status was known (for example, a message over
        `max_message_bytes`, or an exception raised by `on_stderr`), that
        original error is raised instead.

        :return: `ACPAgentResult` with the agent's `exit_code` and, if the process failed, its `error` message
        """
        return await self._running()[0].wait()

    async def stop(
        self,
        *,
        timeout: float = DEFAULT_STOP_TIMEOUT,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Stop the agent: send EOF to its stdin and kill it if it has not
        exited within `timeout` of this call. Messages the agent sends after
        this call are not delivered. It does nothing if the agent is not running.

        :param timeout: Time for the agent to exit in **seconds**; defaults to ``DEFAULT_STOP_TIMEOUT`` (5 seconds)
        :param request_timeout: Timeout for the request that closes the agent's stdin in **seconds**

        :raises SandboxException: If the agent could not be killed
        """
        if self._transport is not None:
            await self._transport.close(timeout, request_timeout)

    async def kill(self) -> bool:
        """
        Kill the agent process with `SIGKILL`.

        :return: `True` if the agent was killed, `False` if it was not found or not started
        """
        if self._transport is None:
            return False
        return await self._transport.kill()


__all__ = [
    "DEFAULT_MAX_MESSAGE_BYTES",
    "DEFAULT_STOP_TIMEOUT",
    "ACPException",
    "AsyncACPAgent",
    "ACPAgentResult",
    "StderrHandler",
]
