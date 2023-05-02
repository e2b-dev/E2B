from abc import ABC, abstractmethod
from typing import Dict, Literal


# The schema for agent config and interaction data is serializable and
# the format for interations with the agent is based on a modified JSON-RPC 2.0 spec (should we use less modified JSON-RPC?).

# This way is to have a schema for communication and a tools that can for example take
# the implementation of AgentBase class and generate REST server that implements the schema
# that then be deployed on our platform.

# For local testing there can be a CLI that takes the implementation of AgentBase class
# and just starts the server and exposes exposes the functionality with a premade web UI where you can test the agent immediately.

# Later we can start supporting other ways to generate the server, for example a gRPC or WS server.
# This is orthogonal to the environment where the agent is deployed.
# The agent can still can be deployed as a Python task, in a Firecracker VM, as a docker container, etc.


JsonValue = None | int | str | bool
JsonType = None | Dict[str, JsonValue | "JsonType"]


class AgentLog:
    type: Literal["log", "error", "output"]
    timestamp: str
    data: JsonType


AgentConfig = JsonType


class AgentInteraction:
    interaction_id: str
    type: str
    data: JsonType


class AgentInteractionResponse:
    data: JsonType


class AgentInteractionRequest:
    interaction_id: str
    type: str
    data: JsonType


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
    def create(cls, config: AgentConfig) -> "AgentBase":
        """Create an agent with the given config without starting it."""
        pass

    @abstractmethod
    async def start(self):
        """Start the agent. Started agent can immediately be interacting with the the world."""
        pass

    @abstractmethod
    async def stop(self):
        """Stop the agent and clean used resources. Stopped agent cannot be started again."""
        pass

    @abstractmethod
    async def interaction(
        self,
        interaction: AgentInteraction,
    ) -> AgentInteractionResponse:
        pass

    @abstractmethod
    async def handle_log(self, log: AgentLog):
        pass

    @abstractmethod
    async def handle_interaction_request(self, request: AgentInteractionRequest):
        pass
