import os
import uuid

from pprint import pprint
from dotenv import load_dotenv
from typing import List
from playground_client.exceptions import NotFoundException
from quart import Quart, request
from quart_cors import cors

from codegen import Codegen
from codegen.tools.playground import create_playground_tools
from database import Database, DeploymentState
from codegen.tools.human.tools import create_human_tools

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SECRET_KEY")

if not url or not key:
    raise NotFoundException("Suapbase credentials not found")

db = Database(url, key)

app = Quart(__name__)
app = cors(app, allow_origin="*")


def get_request_body_template(blocks: List[dict[str, str]]):
    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["content"] if len(request_body_blocks) > 0 else None
    )
    return request_body_template


@app.route("/health", methods=["GET"])
async def health():
    return "OK"


# TODO: SECURITY - Check if user invoking this request has permission to generate and deploy to this project
@app.route("/generate", methods=["POST"])
async def generate():
    body = await request.json

    run_id = str(uuid.uuid4())
    project_id = body["projectID"]
    route_id = body["routeID"]
    blocks = body["blocks"]
    method = body["method"]
    route = body["route"]

    pprint("+++ Blocks:")
    pprint(blocks)
    pprint("--- Blocks:")

    await db.create_deployment(run_id=run_id, project_id=project_id, route_id=route_id)
    playground = None

    try:
        # Create playground for the LLM
        playground_tools, playground = create_playground_tools(
            get_envs=lambda: db.get_env_vars(project_id),
            route=route,
            method=method,
            request_body_template=get_request_body_template(blocks),
        )

        human_tools = list(create_human_tools(run_id=run_id, playground=playground))

        # Create a new instance of code generator
        cg = Codegen.from_tools_and_database(
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
            run_id=run_id,
            route=route,
            method=method,
            blocks=blocks,
        )

        await db.update_state(run_id=run_id, state=DeploymentState.Deploying)
        url = await playground.deploy(project_id)

        await db.finish_deployment(run_id=run_id, url=url)
        return {}
    except:
        await db.update_state(run_id=run_id, state=DeploymentState.Error)
        raise
    finally:
        if playground is not None:
            playground.close()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=True)
