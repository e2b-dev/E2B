from typing import List, Tuple
from abc import ABC, abstractmethod

from agent.base import AgentBase, AgentConfig


class DeploymentAdapter(ABC):
    """
    This is an abstract class that defines the interface for a deployment adapter.

    With this interface, we can create different deployment adapters that can be used
    to deploy and manage agents in different ways.

    For example, we can have a deployment adapter that deploys agents created by our library (without the need to use FCs right now) as Python tasks,
    a deployment adapter that deploys agents with arbiratry code in a Firecracker VM when we need it,
    or a deployment adapter that deploys agents as a docker container later.
    """

    @abstractmethod
    async def create_deployed_agent(self, config: AgentConfig) -> Tuple[str, AgentBase]:
        pass

    @abstractmethod
    async def remove_deployed_agent(self, deployment_id: str):
        pass

    @abstractmethod
    async def get_deployed_agent(self, deployment_id: str) -> AgentBase:
        pass

    @abstractmethod
    async def get_deployed_agents(self) -> List[Tuple[str, AgentBase]]:
        pass
