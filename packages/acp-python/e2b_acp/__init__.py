"""
Run [Agent Client Protocol](https://agentclientprotocol.com) agents in E2B sandboxes.
"""

from typing import Dict, Optional

import acp
from e2b import AsyncSandbox
from e2b.connection_config import Username

from .transport import AcpAgentExit, AcpTransport, StderrHandler
from .utils import DEFAULT_MAX_MESSAGE_BYTES


class AcpAgent:
    """
    ACP agent running in a sandbox, connected to your client.
    """

    def __init__(self, transport: AcpTransport, connection: acp.ClientSideConnection):
        self._transport = transport
        self._connection = connection

    @property
    def connection(self) -> acp.ClientSideConnection:
        """
        Connection to the agent. Use it to initialize, create sessions and send prompts.
        """
        return self._connection

    @property
    def pid(self) -> int:
        """
        Process ID of the agent in the sandbox.
        """
        return self._transport.pid

    async def wait(self) -> AcpAgentExit:
        """
        Wait for the agent process to exit.

        It raises if the agent's output stream failed before its exit status was known.

        :return: Exit status of the agent
        """
        return await self._transport.wait()

    async def close(self, timeout: float = 5) -> None:
        """
        Close the agent: send EOF to its stdin and kill it if it has not
        exited within `timeout` of this call. Messages the agent sends after
        this call are not delivered. It raises if the agent could not be
        killed.

        :param timeout: Time for the agent to exit in **seconds**
        """
        await self._transport.close(timeout)

    async def kill(self) -> bool:
        """
        Kill the agent process with `SIGKILL`.

        :return: `True` if the agent was killed, `False` if it was not found
        """
        return await self._transport.kill()


async def connect_acp_agent(
    sandbox: AsyncSandbox,
    command: str,
    client: acp.Client,
    cwd: Optional[str] = None,
    envs: Optional[Dict[str, str]] = None,
    user: Optional[Username] = None,
    on_stderr: Optional[StderrHandler] = None,
    max_message_bytes: int = DEFAULT_MAX_MESSAGE_BYTES,
    request_timeout: Optional[float] = None,
) -> AcpAgent:
    """
    Start an ACP agent in the sandbox and connect your ACP client to it over
    the agent's stdin/stdout.

    The client filesystem and terminal capabilities are turned off in
    `initialize`, and agent requests for `fs/*` or `terminal/*` are answered
    with an error without reaching your client, so the agent edits files and
    runs commands with its own tools in the sandbox. Network access and MCP
    servers you pass to the agent are not restricted.

    ```python
    import acp
    from e2b import AsyncSandbox
    from e2b_acp import connect_acp_agent

    sandbox = await AsyncSandbox.create("goose")
    agent = await connect_acp_agent(sandbox, "goose acp", client)
    await agent.connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
    # ...
    await agent.close()
    ```

    :param sandbox: Sandbox with the agent installed
    :param command: Command that starts the agent in ACP mode, for example `goose acp`
    :param client: Your ACP client. It answers permission requests and receives the agent's session updates
    :param cwd: Working directory of the agent
    :param envs: Environment variables for the agent
    :param user: User to run the agent as
    :param on_stderr: Callback for the agent's stderr output (logs). The agent's stdout is reserved for the protocol
    :param max_message_bytes: Maximum size of a single message from the agent in **bytes**
    :param request_timeout: Timeout for starting the agent in **seconds**

    :return: `AcpAgent` with the ACP connection
    """
    transport = AcpTransport(sandbox, max_message_bytes, on_stderr)
    await transport.start(command, envs, user, cwd, request_timeout)
    return AcpAgent(transport, acp.connect_to_agent(client, transport))


__all__ = ["AcpAgent", "AcpAgentExit", "connect_acp_agent"]
