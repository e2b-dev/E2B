import os
import uuid
from codegen.tools.human.tools import create_human_tools

from dotenv import load_dotenv
from typing import List
from quart import Quart, request
from quart_cors import cors

from session.env import EnvVar
from codegen import Codegen
from codegen.tools.playground import create_playground_tools
from database import Database, DeploymentState

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SECRET_KEY")
db = Database(url, key)

app = Quart(__name__)
app = cors(app, allow_origin="*")


def get_request_body_template(blocks: List[dict[str, str]]):
    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["prompt"] if len(request_body_blocks) > 0 else None
    )
    return request_body_template


@app.route("/health", methods=["GET"])
async def health():
    return "OK"


@app.route("/generate", methods=["POST"])
async def generate():
    body = await request.json

    run_id = str(uuid.uuid4())
    project_id = body["projectID"]
    route_id = body["routeID"]
    blocks = body["blocks"]
    method = body["method"]
    route = body["route"]

    # TODO: STOP SENDING ENVS FROM FRONTEND BECAUSE WE FETCH THEM FROM DB
    envs: List[EnvVar] = body["envs"]

    # `get_env_vars()` returns a list of dicts. See the docstring comment inside `get_env_vars`
    env = await db.get_env_vars(project_id)
    # TODO: ------------------

    await db.create_deployment(run_id=run_id, project_id=project_id, route_id=route_id)
    playground = None
    try:
        # Create playground for the LLM
        playground_tools, playground = create_playground_tools(
            envs=envs,
            route=route,
            method=method,
            request_body_template=get_request_body_template(blocks),
        )

        human_tools = list(create_human_tools(run_id=run_id, playground=playground))

        # Create a new instance of code generator
        cg = Codegen.from_playground_and_database(
            # The order in which we pass tools HAS an effect on the LLM behaviour.
            custom_tools=[
                *playground_tools,
                *human_tools,
            ],
            database=db,
        )

        # Generate the code
        print("Generating...", flush=True)
        await cg.generate(
            project_id=project_id,
            run_id=run_id,
            route=route,
            method=method,
            blocks=blocks,
        )

        await db.update_state(run_id=run_id, state=DeploymentState.Deploying)
        url = playground.deploy(project_id, envs)

        await db.finish_deployment(run_id=run_id, url=url)
        return {}
    except:
        await db.update_state(run_id=run_id, state=DeploymentState.Error)
        raise
    finally:
        if playground is not None:
            playground.close()
