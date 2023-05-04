from typing import Literal
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models.base import ModelConfig

from agent.base import AgentInteraction
from agent.base import AgentConfig
from deployment.in_memory import InMemoryDeploymentManager
from agent.json_rpc_connector import JsonRpcAgentConnector
from agent.basic_agent import BasicAgent

# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(title="e2b-api-service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

deployment_manager = InMemoryDeploymentManager(agent_factory=BasicAgent.create)


@app.websocket("/dev/agent")
async def ws_agent_run(websocket: WebSocket):
    print("ws_agent_run")
    await websocket.accept()
    connector = JsonRpcAgentConnector(
        iter_json=websocket.iter_json,
        send_json=websocket.send_json,
        agent_factory=BasicAgent.create,
    )
    try:
        await connector.handle()
    except:
        await connector.close()


@app.post("/deployment")
async def create_agent_deployment(body: AgentConfig, project_id: str):
    deployment = await deployment_manager.create_deployment(
        body,
        project_id=project_id,
    )
    return {"id": deployment.id}


class AgentDeploymentStatusBody(BaseModel):
    status: Literal["running", "stopped"]


@app.put("/deployment/{id}/status")
async def change_agent_deployment_status(id: str, body: AgentDeploymentStatusBody):
    deployment = await deployment_manager.get_deployment(id)
    if body.status == "running":
        await deployment.start()
    elif body.status == "stopped":
        await deployment.stop()


@app.post("/deployment/{id}/interaction")
async def interact_with_agent_deployment(id: str, body: AgentInteraction):
    deployment = await deployment_manager.get_deployment(id)
    result = await deployment.agent.interaction(body)
    return result


@app.get("/deployment/{id}/status")
async def get_agent__deployment_status(id: str):
    deployment = await deployment_manager.get_deployment(id)
    return {"status": deployment.status}
