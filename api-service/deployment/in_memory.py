from typing import Any, Dict, List

from database.base import db
from deployment.manager import AgentDeploymentManager, AgentDeployment
from agent.from_template import get_agent_factory_from_template


# TODO: Interemediate step between implementing the FC agent deployment
# can be improving the in-memory deployment manager to use the processes instead of threads.
class InMemoryDeploymentManager(AgentDeploymentManager):
    def __init__(self):
        self._deployments: Dict[str, AgentDeployment] = {}

    async def create_deployment(
        self,
        id: str,
        project_id: str,
        config: Any,
        logs: List[Any],
    ):
        print("Creating deployment", config, logs)
        deployment = await AgentDeployment.from_factory(
            id,
            get_agent_factory_from_template(config["templateID"]),
            project_id,
            config,
            logs,
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
        logs: List[Any],
    ):
        print(">>>> Updating deployment", id, config, logs)
        try:
            await self.remove_deployment(id)
        except:
            print("Failed to remove deployment", id)
            pass
        return await self.create_deployment(
            id,
            project_id,
            config,
            logs,
        )

    async def remove_deployment(self, id: str):
        deployment = await self.get_deployment(id)
        if deployment:
            await deployment.agent.stop()
            del self._deployments[deployment.id]

        await db.update_deployment(id, enabled=False)

    async def get_deployment(self, id: str):
        return self._deployments.get(id, None)

    async def list_deployments(self) -> list[AgentDeployment]:
        return list(self._deployments.values())
