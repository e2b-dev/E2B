from abc import abstractmethod, ABC
from typing import Coroutine, List, Callable, Any
from pydantic import BaseModel

from session.env import EnvVar

# The schema for agent config and interaction data is serializable and
# the format for interactions with the agent is based on a modified JSON-RPC 2.0 spec (should we use less modified JSON-RPC?).

# This way is to have a schema for communication and a tools that can for example take
# the implementation of AgentBase class and generate REST server that implements the schema
# that then be deployed on our platform.

# For local testing there can be a CLI that takes the implementation of AgentBase class
# and just starts the server and exposes the functionality with a pre-made web UI where you can test the agent immediately.

# Later we can start supporting other ways to generate the server, for example a gRPC or WS server.
# This is orthogonal to the environment where the agent is deployed.
# The agent can still be deployed as a Python task, in a Firecracker VM, as a docker container, etc.


class AgentInteraction(BaseModel):
    interaction_id: str | None = None
    type: str
    data: Any


class AgentInteractionRequest(BaseModel):
    interaction_id: str
    type: str
    data: Any = None


OnLogs = Callable[[Any], Coroutine[None, None, None]]
SetRun = Callable[[str], None]
OnInteractionRequest = Callable[[AgentInteractionRequest], Coroutine[None, None, None]]
GetEnvs = Callable[[], Coroutine[Any, Any, List[EnvVar]]]


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
    async def create(
        cls,
        config: Any,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ) -> "AgentBase":
        """Create an agent with the given config without starting it."""
        pass

    @abstractmethod
    async def stop(self):
        """Stop the agent and clean used resources."""
        pass

    @abstractmethod
    def is_running(self) -> bool:
        """Check if the agent run is in progress."""
        pass

    @abstractmethod
    async def interaction(self, interaction: AgentInteraction) -> Any:
        pass
