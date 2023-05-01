from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models.base import ModelConfig

from agent.ws import WebsocketAgentRun

# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(title="e2b-api-service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/dev/agent")
async def ws_agent_run(websocket: WebSocket):
    run = WebsocketAgentRun(websocket)
    await run.handle_agent_run()


@app.get("/health")
async def health():
    return {"status": "ok"}


class DeployConfig(BaseModel):
    pass

class AgentCreateBody(BaseModel):
    model_config: ModelConfig
    deploy_config: DeployConfig


@app.post("/agent")
async def create_agent(body: AgentCreateBody):
    pass


class AgentRunBody(BaseModel):
    instructions: str


@app.post("/agent/{id}/run")
async def run_agent(id: str, body: AgentRunBody):
    pass


@app.get("/agent/{id}/run/{run_id}/status")
async def get_agent_run_status(id: str, run_id: str):
    pass


@app.get("/agent/{id}/run/{run_id}/result")
async def get_agent_run_result(id: str, run_id: str):
    pass
