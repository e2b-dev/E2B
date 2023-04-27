from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from agent.ws import WebsocketAgentRun

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
    await WebsocketAgentRun.handle_agent_run(websocket)
