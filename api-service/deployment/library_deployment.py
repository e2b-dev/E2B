import uuid

from typing import Callable, Dict, List, Tuple

from deployment.adapter import DeploymentAdapter
from agent.base import AgentBase, AgentConfig


class LibraryDeployment(DeploymentAdapter):
    def __init__(self, agent_factory: Callable[[AgentConfig], AgentBase]) -> None:
        self._agent_factory = agent_factory
        self._deployments: Dict[str, AgentBase] = {}

    async def create_deployed_agent(self, config: AgentConfig):
        agent = self._agent_factory(config)
        id = str(uuid.uuid4())
        self._deployments[id] = agent
        return (id, agent)

    async def remove_deployed_agent(self, deployment_id: str):
        agent = await self.get_deployed_agent(deployment_id)
        await agent.stop()
        del self._deployments[deployment_id]

    async def get_deployed_agent(self, deployment_id: str):
        return self._deployments[deployment_id]

    async def get_deployed_agents(self) -> List[Tuple[str, AgentBase]]:
        return [
            (deployment_id, agent) for deployment_id, agent in self._deployments.items()
        ]
