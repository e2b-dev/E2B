from typing import Any, Dict

from database.base import db
from deployment.manager import AgentDeploymentManager, AgentDeployment, AgentFactory


class InMemoryDeploymentManager(AgentDeploymentManager):
    def __init__(
        self,
        agent_factory: AgentFactory,
    ):
        self._agent_factory = agent_factory
        self._deployments: Dict[str, AgentDeployment] = {}

    async def create_deployment(
        self,
        config: Any,
        project_id: str,
    ):
        deployment = await AgentDeployment.from_factory(
            self._agent_factory,
            project_id,
            config,
        )
        try:
            await db.upsert_deployment(deployment.id, project_id)
        except:
            await deployment.agent.stop()
            raise

        self._deployments[deployment.id] = deployment
        return deployment

    async def remove_deployment(self, id: str):
        deployment = await self.get_deployment(id)
        await deployment.agent.stop()
        await db.upsert_deployment(deployment.id, enabled=False)
        del self._deployments[deployment.id]

    async def get_deployment(self, id: str):
        return self._deployments[id]

    async def list_deployments(self):
        return list(self._deployments.values())
