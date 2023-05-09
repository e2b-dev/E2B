from typing import Any, Callable, Coroutine, List
from abc import abstractmethod, ABC

from database.base import db
from agent.base import (
    AgentBase,
    AgentInteractionRequest,
    OnLogs,
    OnInteractionRequest,
    GetEnvs,
)


AgentFactory = Callable[
    [Any, GetEnvs, OnLogs, OnInteractionRequest], Coroutine[None, None, AgentBase]
]


class AgentEvents:
    def __init__(self, id: str) -> None:
        self.id = id
        self.logs: List[Any] = []
        self.interaction_requests: List[AgentInteractionRequest] = []

    async def overwrite_logs(self, logs: List[Any]):
        self.logs = logs
        await db.update_deployment_logs(self.id, logs)

    async def add_interaction_request(
        self, interaction_request: AgentInteractionRequest
    ):
        self.interaction_requests.append(interaction_request)

    def remove_interaction_request(self, interaction_id: str):
        self.interaction_requests = [
            interaction_request
            for interaction_request in self.interaction_requests
            if interaction_request.interaction_id != interaction_id
        ]


class AgentDeployment:
    def __init__(self, id, agent: AgentBase, event_handler: AgentEvents):
        self.id = id
        self.agent = agent
        self.event_handler = event_handler

    @classmethod
    async def from_factory(
        cls,
        deployment_id: str,
        factory: AgentFactory,
        project_id: str,
        config: Any,
    ):
        event_handler = AgentEvents(deployment_id)
        agent = await factory(
            config,
            lambda: db.get_env_vars(project_id),
            event_handler.overwrite_logs,
            event_handler.add_interaction_request,
        )
        return cls(deployment_id, agent, event_handler)


class AgentDeploymentManager(ABC):
    """
    This is an abstract class that defines the interface for a deployment adapter.

    With this interface, we can create different deployment adapters that can be used
    to deploy and manage agents in different ways.

    For example, we can have a deployment adapter that deploys agents created by our library (without the need to use FCs right now) as Python tasks,
    a deployment adapter that deploys agents with arbiratry code in a Firecracker VM when we need it,
    or a deployment adapter that deploys agents as a docker container later.
    """

    @abstractmethod
    async def create_deployment(self, config: Any, **kwargs) -> AgentDeployment:
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

    @abstractmethod
    async def update_deployment(
        self,
        id: str,
        config: Any,
        **kwargs,
    ) -> AgentDeployment:
        pass
