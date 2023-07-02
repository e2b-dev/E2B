import os
import uuid
import aiohttp
import json

from datetime import datetime
from typing import Any, Callable, Coroutine, List
from abc import abstractmethod, ABC

from .work_queue import WorkQueue


from database.base import db
from agent.base import (
    AgentBase,
    AgentInteractionRequest,
    OnLogs,
    SetRun,
    OnInteractionRequest,
    GetEnvs,
)

AgentFactory = Callable[
    [Any, GetEnvs, SetRun, OnLogs, OnInteractionRequest],
    Coroutine[None, None, AgentBase],
]

app_url = os.environ.get("APP_URL", "http://localhost:3000")
secret_token = os.environ.get("SECRET_TOKEN")


async def agent_run_done(deployment_id: str, prompt: str):
    async with aiohttp.ClientSession() as client:
        async with client.post(
            f"{app_url}/api/agent/run",
            data=json.dumps(
                {
                    "deployment_id": deployment_id,
                    "prompt": prompt,
                }
            ),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {secret_token}",
            },
        ) as response:
            await response.json()


async def agent_run_cancelled(deployment_id: str):
    async with aiohttp.ClientSession() as client:
        async with client.delete(
            f"{app_url}/api/agent/run",
            data=json.dumps(
                {
                    "deployment_id": deployment_id,
                }
            ),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {secret_token}",
            },
        ) as response:
            await response.json()


class AgentEvents:
    def __init__(self, deployment_id: str, project_id: str) -> None:
        self.deployment_id = deployment_id
        self.logs: List[Any] = []
        self.interaction_requests: List[AgentInteractionRequest] = []
        self.run_id: str | None

        self.log_que = WorkQueue[List[Any]](
            lambda logs: db.update_deployment_logs(
                deployment_id=self.deployment_id,
                run_id=self.run_id,
                project_id=project_id,
                logs=logs,
            )
        )

    def set_run_id(self, run_id: str):
        self.logs = []
        self.run_id = run_id

    async def add_log(self, log: Any):
        date = datetime.now()
        log["timestamp"] = date.isoformat()
        log["id"] = str(uuid.uuid4())
        self.logs.append(log)
        self.log_que.schedule(self.logs)

    async def add_interaction_request(
        self,
        interaction_request: AgentInteractionRequest,
    ):
        self.interaction_requests.append(interaction_request)
        match interaction_request.type:
            case "done":
                await agent_run_done(
                    self.deployment_id, interaction_request.data["prompt"]
                )
            case "cancelled":
                await agent_run_cancelled(self.deployment_id)
            # case "failed":
            #     # TODO: Save agent/interactions/states/run
            #     await agent_run_failed(self.id)

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
        event_handler = AgentEvents(deployment_id=deployment_id, project_id=project_id)
        agent = await factory(
            config,
            lambda: db.get_env_vars(project_id),
            event_handler.set_run_id,
            event_handler.add_log,
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
