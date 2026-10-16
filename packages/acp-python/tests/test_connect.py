import acp
from acp import schema

from e2b import AsyncSandbox
from e2b_acp import connect_acp_agent
from acp_fake_agent import FAKE_AGENT, FAKE_AGENT_CMD, FAKE_AGENT_PATH


class Client:
    async def request_permission(self, session_id, tool_call, options, **kwargs):
        return schema.RequestPermissionResponse(
            outcome=schema.DeniedOutcome(outcome="cancelled")
        )

    async def session_update(self, session_id, update, **kwargs):
        pass


async def test_connect_acp_agent_connects_an_acp_client(async_sandbox: AsyncSandbox):
    await async_sandbox.files.write(FAKE_AGENT_PATH, FAKE_AGENT)
    agent = await connect_acp_agent(async_sandbox, FAKE_AGENT_CMD, Client())

    response = await agent.connection.initialize(
        protocol_version=acp.PROTOCOL_VERSION,
        client_capabilities=schema.ClientCapabilities(terminal=True),
    )

    assert response.protocol_version == 1
    await agent.close()
    assert (await agent.wait()).exit_code == 0
