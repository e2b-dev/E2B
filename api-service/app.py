from typing import Any
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from pydantic import BaseModel

from agent.base import AgentInteraction
from deployment.in_memory import InMemoryDeploymentManager
from agent.json_rpc import JsonRpcAgent
from agent.basic_agent import BasicAgent
from database.base import db

# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(title="e2b-api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

deployment_manager = InMemoryDeploymentManager(agent_factory=BasicAgent.create)


@asynccontextmanager
async def lifespan(app: FastAPI):
    deployments = await db.get_deployments()
    for deployment in deployments:
        if deployment["enabled"]:
            await deployment_manager.create_deployment(
                deployment["config"],
                project_id=deployment["project_id"],
            )
    yield


@app.websocket("/dev/agent")
async def ws_agent_run(websocket: WebSocket, project_id: str):
    await websocket.accept()
    connector = JsonRpcAgent(
        project_id=project_id,
        iter_json=websocket.iter_json,
        send_json=websocket.send_json,
        agent_factory=BasicAgent.create,
    )
    try:
        await connector.handle()
    except:
        await connector.close()
    finally:
        print("Closing websocket")


class CreateDeploymentBody(BaseModel):
    config: Any


@app.get("/deployments")
async def list_deployments():
    deployments = await deployment_manager.list_deployments()
    return {"deployments": deployments}


@app.post("/deployments")
async def create_agent_deployment(body: CreateDeploymentBody, project_id: str):
    deployment = await deployment_manager.create_deployment(
        body.config,
        project_id,
    )
    return {"id": deployment.id}


@app.delete("/deployments/{id}")
async def delete_agent_deployment(id: str):
    await deployment_manager.remove_deployment(id)
    return {}


@app.post("/deployments/{id}/interactions")
async def interact_with_agent_deployment(id: str, body: AgentInteraction):
    deployment = await deployment_manager.get_deployment(id)
    result = await deployment.agent.interaction(body)

    if body.interaction_id:
        deployment.event_handler.remove_interaction_request(
            body.interaction_id,
        )

    return result


@app.get("/deployments/{id}/interaction_requests")
async def get_agent_intereaction_requests(id: str):
    deployment = await deployment_manager.get_deployment(id)
    return {"interaction_requests": deployment.event_handler.interaction_requests}


@app.get("/deployments/{id}/logs")
async def get_agent__deployment_status(id: str):
    deployment = await deployment_manager.get_deployment(id)
    return {"logs": deployment.event_handler.logs}
