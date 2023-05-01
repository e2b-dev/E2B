from typing import List
from abc import ABC, abstractmethod

from agent.base import Agent


class DeploymentAdapter(ABC):
    @abstractmethod
    async def create_deployed_agent(self, deployment):
        pass

    @abstractmethod
    async def remove_deployed_agent(self, deploymen_id: str):
        pass

    @abstractmethod
    async def get_deployed_agent(self, deployment_id: str) -> Agent:
        pass

    @abstractmethod
    async def get_deployed_agents(self) -> List[Agent]:
        pass
