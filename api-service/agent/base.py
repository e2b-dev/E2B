from abc import abstractmethod, ABC
from typing import Any, Coroutine, Dict, List, Literal, Optional, Callable

from pydantic import BaseModel, Json


# The schema for agent config and interaction data is serializable and
# the format for interations with the agent is based on a modified JSON-RPC 2.0 spec (should we use less modified JSON-RPC?).

# This way is to have a schema for communication and a tools that can for example take
# the implementation of AgentBase class and generate REST server that implements the schema
# that then be deployed on our platform.

# For local testing there can be a CLI that takes the implementation of AgentBase class
# and just starts the server and exposes the functionality with a premade web UI where you can test the agent immediately.

# Later we can start supporting other ways to generate the server, for example a gRPC or WS server.
# This is orthogonal to the environment where the agent is deployed.
# The agent can still be deployed as a Python task, in a Firecracker VM, as a docker container, etc.


DataType = Dict[str, Json]


class AgentLog(BaseModel):
    type: Optional[Literal["log", "error", "output"] | str] = None
    timestamp: Optional[str] = None
    data: DataType


class AgentInteraction(BaseModel):
    interaction_id: Optional[str] = None
    type: str
    data: DataType


class AgentInteractionResponse(BaseModel):
    data: DataType


class AgentInteractionRequest(BaseModel):
    interaction_id: str
    type: str
    data: DataType


class AgentConfig:
    def __init__(
        self,
        data: DataType,
        on_logs: Callable[[List[AgentLog]], Coroutine[None, None, None]],
        on_interaction_request: Callable[
            [AgentInteractionRequest], Coroutine[None, None, None]
        ],
        on_close: Callable[[], Coroutine[None, None, None]],
    ):
        self.data = data
        self.on_logs = on_logs
        self.data = data
        self.on_interaction_request = on_interaction_request
        self.on_close = on_close


class AgentBase(ABC):
    """
    This is an abstract class that defines the interface for an agent.

    The methods defined here are the ones needed to run an agent.
    They closely follow our spec for agent deployment.

    Class implementing this interface can be used to deploy agents via the "library deployment" as a Python task
    or via the FC by wrapping the class in a server that exposes the methods and starting the server in an FC.
    """

    @classmethod
    @abstractmethod
    async def create(cls, config: AgentConfig) -> "AgentBase":
        """Create an agent with the given config without starting it."""
        pass

    @abstractmethod
    async def start(self, data: DataType | None = None):
        """Start the agent. Started agent can immediately be interacting with the the world."""
        pass

    @abstractmethod
    async def stop(self):
        """Stop the agent and clean used resources. Stopped agent cannot be started again."""
        pass

    @abstractmethod
    async def get_interactions(self):
        """Return a list of interactions that the agent can handle and that can be requested."""
        pass

    @abstractmethod
    async def interaction(
        self,
        interaction: AgentInteraction,
    ) -> AgentInteractionResponse:
        pass
