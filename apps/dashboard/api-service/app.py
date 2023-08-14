import json
import uuid
import os

from typing import Annotated, Any
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, config
from fastapi.security import OAuth2PasswordBearer
from opentelemetry import trace

from observability import total_deployments_counter, total_deployment_runs_counter
from agent.base import AgentInteraction
from deployment.in_memory import InMemoryDeploymentManager
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


app = FastAPI(
    title="e2b-api",
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


class CreateDeploymentBody(BaseModel):
    config: Any
    secrets: Any


@app.put("/deployments")
async def create_agent_deployment(
    body: CreateDeploymentBody,
    project_id: str,
    token: Annotated[str, Depends(oauth2_scheme)],
):
    check_token(token)
    db_deployment = await db.get_deployment(project_id)

    if db_deployment:
        secrets = (
            json.loads(db_deployment["decrypted_secrets"])
            if db_deployment.get("decrypted_secrets", None)
            else {}
        )
        print("secrets", secrets)
        deployment = await deployment_manager.update_deployment(
            db_deployment["id"],
            project_id,
            {
                **db_deployment["config"],
                **body.config,
            },
            {
                **secrets,
                **body.secrets,
            },
        )
        current_span = trace.get_current_span()
        current_span.set_attributes(
            {
                "deployment_id": deployment.id,
                "project_id": project_id,
            }
        )
        total_deployments_counter.add(
            1,
            {
                "project_id": project_id,
                "deployment_id": deployment.id,
                "agent": "SmolDeveloper",
                "update": True,
            },
        )
        return {"id": deployment.id}
    else:
        id = str(uuid.uuid4())
        deployment = await deployment_manager.create_deployment(
            id,
            project_id,
            body.config,
            body.secrets,
        )
        current_span = trace.get_current_span()
        current_span.set_attributes(
            {
                "deployment_id": deployment.id,
                "project_id": project_id,
            }
        )
        total_deployments_counter.add(
            1,
            {
                "project_id": project_id,
                "deployment_id": id,
                "agent": "SmolDeveloper",
            },
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
        # Get deployment from db if enabled
        db_deployment = await db.get_deployment_by_id(id)
        if (
            db_deployment
            and db_deployment["enabled"]
            and db_deployment.get("config", None)
            and db_deployment.get("project_id", None)
        ):
            deployment = await deployment_manager.create_deployment(
                db_deployment["id"],
                db_deployment["project_id"],
                db_deployment["config"],
                json.loads(db_deployment["decrypted_secrets"])
                if db_deployment.get("decrypted_secrets", None)
                else {},
            )
        else:
            raise HTTPException(status_code=404, detail="Deployment not found")

    current_span = trace.get_current_span()
    current_span.set_attributes(
        {
            "deployment_id": id,
        }
    )

    total_deployment_runs_counter.add(1, {"deployment_id": id})
    result = await deployment.agent.interaction(body)
    if body.interaction_id:
        deployment.event_handler.remove_interaction_request(body.interaction_id)
    return result
