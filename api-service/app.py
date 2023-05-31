import uuid
import os

from typing import Annotated, Any
from fastapi import Depends, FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer


from agent.base import AgentInteraction
from deployment.in_memory import InMemoryDeploymentManager
from json_rpc import JsonRpcAgentConnection
from database.base import db

deployment_manager = InMemoryDeploymentManager()

# TODO: Add proper auth
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="")
secret_token = os.environ.get("SECRET_TOKEN")


def check_token(token: str | None):
    if not secret_token:
        return
    if token == secret_token:
        return
    raise HTTPException(status_code=401, detail="Invalid token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    deployments = await db.get_deployments()
    for deployment in deployments:
        if (
            deployment["enabled"]
            and deployment.get("config", None)
            and deployment.get("project_id", None)
        ):
            print("Restarting deployment", deployment["id"])
            await deployment_manager.create_deployment(
                deployment["id"],
                deployment["project_id"],
                deployment["config"],
            )
    yield


# TODO: Fix proxying - https://fastapi.tiangolo.com/advanced/behind-a-proxy/
app = FastAPI(
    title="e2b-api",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"Status": "Ok"}


@app.websocket("/dev/agent")
async def ws_agent_run(websocket: WebSocket, project_id: str):
    await websocket.accept()

    connection = JsonRpcAgentConnection(
        project_id=project_id,
        iter_json=websocket.iter_json,
        send_json=websocket.send_json,
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
async def list_deployments(token: Annotated[str, Depends(oauth2_scheme)]):
    check_token(token)
    deployments = await deployment_manager.list_deployments()
    return {"deployments": [{"id": deployment.id} for deployment in deployments]}


@app.put("/deployments")
async def create_agent_deployment(
    body: CreateDeploymentBody,
    project_id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
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
async def delete_agent_deployment(
    id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    await deployment_manager.remove_deployment(id)


@app.get("/deployments/{id}")
async def get_agent_deployment(
    id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    deployment = await deployment_manager.get_deployment(id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {
        "id": deployment.id,
        "logs": len(deployment.event_handler.logs),
        "interaction_request": len(deployment.event_handler.interaction_requests),
    }


@app.post("/deployments/{id}/interactions")
async def interact_with_agent_deployment(
    id: str,
    body: AgentInteraction,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    deployment = await deployment_manager.get_deployment(id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    result = await deployment.agent.interaction(body)
    if body.interaction_id:
        deployment.event_handler.remove_interaction_request(body.interaction_id)
    return result


@app.get("/deployments/{id}/interaction_requests")
async def get_agent_intereaction_requests(
    id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    deployment = await deployment_manager.get_deployment(id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {"interaction_requests": deployment.event_handler.interaction_requests}


@app.get("/deployments/{id}/logs")
async def get_agent_deployment_status(
    id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    deployment = await deployment_manager.get_deployment(id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {"logs": deployment.event_handler.logs}
