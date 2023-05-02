from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models.base import ModelConfig


from deployment.library_deployment import LibraryDeployment
from agent.ws import WebsocketAgentRun
from agent.simple_agent import SimpleAgent

# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(title="e2b-api-service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

deployment_manager = LibraryDeployment(agent_factory=SimpleAgent.create)
debug_agent_manager = LibraryDeployment(agent_factory=SimpleAgent.create)

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


class AgentRunBody(BaseModel):
    instructions: str


@app.post("/agent")
async def create_agent(body: AgentCreateBody):
    await deployment_manager.create_deployed_agent(body.model_config)


@app.post("/agent/{id}/run")
async def run_agent(id: str, body: AgentRunBody):
    pass


@app.get("/agent/{id}/run/{run_id}/status")
async def get_agent_run_status(id: str, run_id: str):
    pass


@app.get("/agent/{id}/run/{run_id}/result")
async def get_agent_run_result(id: str, run_id: str):
    pass
