from re import DEBUG
import uuid

from typing import Callable, Coroutine, Dict
from pydantic import PrivateAttr

from database.base import db
from deployment.manager import AgentDeploymentManager, AgentDeployment
from agent.base import AgentBase, AgentConfig


class InMemoryDeploymentManager(AgentDeploymentManager):
    agent_factory: Callable[[AgentConfig], Coroutine[None, None, AgentBase]]
    _deployments: Dict[str, AgentDeployment] = PrivateAttr(default={})

    async def create_deployment(
        self,
        config: AgentConfig,
        project_id: str,
    ):
        agent = await self.agent_factory(config)
        deployment = AgentDeployment(
            id=str(uuid.uuid4()),
            agent=agent,
        )
        await db.upsert_deployment(deployment.id, project_id)

        self._deployments[deployment.id] = deployment

        return deployment

    async def remove_deployment(self, id: str):
        deployment = await self.get_deployment(id)
        await deployment.agent.stop()
        del self._deployments[deployment.id]

    async def get_deployment(self, id: str):
        return self._deployments[id]

    async def list_deployments(self):
        return list(self._deployments.values())
