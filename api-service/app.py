import uuid

from typing import Any
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel

from agent.base import AgentInteraction
from deployment.in_memory import InMemoryDeploymentManager
from json_rpc import JsonRpcAgentConnection
from agent.basic_agent import BasicAgent
from database.base import db

deployment_manager = InMemoryDeploymentManager(agent_factory=BasicAgent.create)


@asynccontextmanager
async def lifespan(app: FastAPI):
    deployments = await db.get_deployments()
    for deployment in deployments:
        if deployment["enabled"]:
            if deployment.get("config", None) and deployment.get("project_id", None):
                print("Restarting deployment", deployment["id"])
                await deployment_manager.create_deployment(
                    deployment["id"],
                    deployment["project_id"],
                    deployment["config"],
                )
    yield


# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(title="e2b-api", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/dev/agent")
async def ws_agent_run(websocket: WebSocket, project_id: str):
    await websocket.accept()
    connection = JsonRpcAgentConnection(
        project_id=project_id,
        iter_json=websocket.iter_json,
        send_json=websocket.send_json,
        agent_factory=BasicAgent.create,
    )
    try:
        await connection.handle()
    except:
        await connection.close()
    finally:
        print("Closing websocket")


class CreateDeploymentBody(BaseModel):
    config: Any


@app.get("/deployments")
async def list_deployments():
    deployments = await deployment_manager.list_deployments()
    return {"deployments": [{"id": deployment.id} for deployment in deployments]}


@app.put("/deployments")
async def create_agent_deployment(body: CreateDeploymentBody, project_id: str):
    db_deployment = await db.get_deployment(project_id)

    if db_deployment:
        deployment = await deployment_manager.update_deployment(
            db_deployment["id"],
            project_id,
            body.config,
        )
        return {"id": deployment.id}
    else:
        id = str(uuid.uuid4())
        deployment = await deployment_manager.create_deployment(
            id,
            project_id,
            body.config,
        )
        return {"id": deployment.id}


@app.delete("/deployments/{id}", status_code=204)
async def delete_agent_deployment(id: str):
    await deployment_manager.remove_deployment(id)


@app.post("/deployments/{id}/interactions")
async def interact_with_agent_deployment(id: str, body: AgentInteraction):
    deployment = await deployment_manager.get_deployment(id)
    result = await deployment.agent.interaction(body)

    if body.interaction_id:
        deployment.event_handler.remove_interaction_request(body.interaction_id)
    return result


@app.get("/deployments/{id}/interaction_requests")
async def get_agent_intereaction_requests(id: str):
    deployment = await deployment_manager.get_deployment(id)
    return {"interaction_requests": deployment.event_handler.interaction_requests}


@app.get("/deployments/{id}/logs")
async def get_agent__deployment_status(id: str):
    deployment = await deployment_manager.get_deployment(id)
    return {"logs": deployment.event_handler.logs}
