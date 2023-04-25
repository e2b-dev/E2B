from typing import Callable, Coroutine, Dict, List, Any
import uuid
import asyncio
from codegen.callbacks.log_processor import LogProcessor
from codegen.callbacks.logs import OnLogs
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.base import ModelConfig
from codegen.agent.parsing import Log, ThoughtLog, ToolLog
from database.database import DeploymentState
from run import run_agent

app = FastAPI(title="e2b-api-service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateBody(BaseModel):
    project_id: str
    model_config: ModelConfig


@app.post("/agent")
async def generate(body: GenerateBody):
    return {}


Notify = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, Any]]


class AgentRun(BaseModel):
    notify: Notify

    async def start(self, project_id: str, model_config: Dict[str, Any]):
        run_id = str(uuid.uuid4())

        async def on_logs(logs: List[Log]):
            await self.notify("logs", {"logs": logs})

        log_processor = LogProcessor(on_logs=on_logs)

        async def start_agent():
            await run_agent(
                project_id=project_id,
                run_id=run_id,
                model_config=ModelConfig(**model_config),
                log_processor=log_processor,
            )
            await self.notify("stateUpdate", {"state": DeploymentState.Finished.value})

        asyncio.create_task(start_agent())
        return {"run_id": run_id}


async def create_ws_agent_handler(websocket: WebSocket):
    async def notify(method: str, params: Dict[str, Any]):
        await websocket.send_json(
            {
                "jsonrpc": "2.0",
                "method": method,
                "params": params,
            }
        )

    async def call(id: str, method: str, params: List[Any]):
        async def handle_call():
            try:
                if method == "start":
                    result = await run.start(*params)
                    return {
                        "result": result,
                    }
                raise Exception(f"Invalid method {method}")
            except Exception as e:
                return {
                    "error": {
                        "code": 1,
                        "message": str(e),
                    }
                }

        response = await handle_call()
        await websocket.send_json(
            {
                "jsonrpc": "2.0",
                "id": id,
                **response,
            }
        )

    run = AgentRun(notify=notify)

    async for data in websocket.iter_json():
        await call(data["id"], data["method"], data["params"])

    print("closing")


@app.websocket("/dev/agent")
async def ws_dev_agent(websocket: WebSocket):
    await websocket.accept()
    await create_ws_agent_handler(websocket)
