import os
import uuid
from session.deploy import Deployment

from session.env import EnvVar

from typing import List
from flask import Flask, abort, request
from flask_cors import CORS

from codegen import Codegen
from codegen.tools.playground import create_playground_tools
from database import Database, DeploymentState

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

db = Database(url, key)

app = Flask(__name__)
CORS(app)


def get_request_body_template(blocks: List[dict[str, str]]):
    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["prompt"] if len(request_body_blocks) > 0 else None
    )
    return request_body_template


@app.route("/health", methods=["GET"])
def health():
    return "OK"


@app.route("/generate", methods=["POST"])
def generate():
    body = request.json

    if body is None:
        abort(400)

    run_id = str(uuid.uuid4())
    project_id = body["projectID"]
    route_id = body["routeID"]
    blocks = body["blocks"]
    method = body["method"]
    route = body["route"]
    envs: List[EnvVar] = body["envs"]
    url: str | None = body["url"]

    request_body_template = get_request_body_template(blocks)

    db.create_deployment(run_id=run_id, project_id=project_id, route_id=route_id)
    try:
        playground_tools, playground = create_playground_tools(
            envs=envs,
            route=route,
            method=method,
            request_body_template=request_body_template,
        )

        cg = Codegen.from_playground_tools(playground_tools)
        cg.generate(
            route=route,
            envs=envs,
            method=method,
            blocks=blocks,
        )
        db.update_state(run_id=run_id, state=DeploymentState.Deploying)

        deployment = Deployment(playground.session, project_id)

        if url is None:
            url = deployment.new(envs=envs)
        else:
            deployment.update(envs=envs)

        db.finish_deployment(run_id=run_id, url=url)

        return {
            "code": "",
            "prompt": "",
            "url": url,
        }
    except:
        db.update_state(run_id=run_id, state=DeploymentState.Error)
        raise


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
