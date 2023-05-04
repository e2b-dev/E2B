from typing import List, Literal
from abc import abstractmethod
from pydantic import BaseModel

from agent.base import AgentBase, AgentConfig, AgentInteractionRequest


class AgentDeployment:
    def __init__(self, id: str, agent: AgentBase):
        self.id = id
        self.agent = agent
        self.status: Literal["running", "stopped"] = "stopped"
        self.interaction_requests: List[AgentInteractionRequest] = []

    async def start(self):
        await self.agent.start()
        self.status = "running"

    async def stop(self):
        await self.agent.stop()
        self.status = "stopped"


class AgentDeploymentManager(BaseModel):
    """
    This is an abstract class that defines the interface for a deployment adapter.

    With this interface, we can create different deployment adapters that can be used
    to deploy and manage agents in different ways.

    For example, we can have a deployment adapter that deploys agents created by our library (without the need to use FCs right now) as Python tasks,
    a deployment adapter that deploys agents with arbiratry code in a Firecracker VM when we need it,
    or a deployment adapter that deploys agents as a docker container later.
    """

    @abstractmethod
    async def create_deployment(self, config: AgentConfig) -> AgentDeployment:
        pass

    @abstractmethod
    async def remove_deployment(self, id: str):
        pass

    @abstractmethod
    async def get_deployment(self, id: str) -> AgentDeployment | None:
        pass

    @abstractmethod
    async def list_deployments(self) -> List[AgentDeployment]:
        pass
