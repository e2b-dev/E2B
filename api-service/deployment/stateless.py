from typing import Any, Dict

from database.base import db
from deployment.manager import AgentDeploymentManager, AgentDeployment
from agent.from_template import get_agent_factory_from_template

class StatelessDeploymentManager(AgentDeploymentManager):
    def __init__(self):
        self._deployments: Dict[str, AgentDeployment] = {}

    async def create_deployment(
        self,
        id: str,
        project_id: str,
        config: Any,
    ):
        deployment = await AgentDeployment.from_factory(
            id,
            get_agent_factory_from_template(config["templateID"]),
            project_id,
            config,
        )
        try:
            await db.create_deployment(deployment.id, project_id, config)
        except:
            await deployment.agent.stop()
            raise

        self._deployments[deployment.id] = deployment
        return deployment

    async def update_deployment(
        self,
        id: str,
        project_id: str,
        config: Any,
    ):
        try:
            await self.remove_deployment(id)
        except:
            print("Failed to remove deployment", id)
            pass
        return await self.create_deployment(
            id,
            project_id,
            config,
        )

    async def remove_deployment(self, id: str):
        deployment = await self.get_deployment(id)
        await deployment.agent.stop()
        await db.update_deployment(deployment.id, enabled=False)
        del self._deployments[deployment.id]

    async def get_deployment(self, id: str):
        return self._deployments[id]

    async def list_deployments(self):
        return list(self._deployments.values())
