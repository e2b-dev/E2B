import os
import uuid
from session.deploy import Deployment

from session.env import EnvVar

from typing import Dict, List
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


def dump(obj):
    for attr in dir(obj):
        print("obj.%s = %r" % (attr, getattr(obj, attr)))


def replace_file_content(fp_in: str, fp_out: str, pairs: Dict[str, str]) -> None:
    with open(fp_in, "rt") as fin:
        with open(fp_out, "wt") as fout:
            for line in fin:
                for old, new in pairs.items():
                    if old in line:
                        line = line.replace(old, new)
                fout.write(line)


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

    code = ""

    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["prompt"] if len(request_body_blocks) > 0 else None
    )

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
            url = deployment.new(code=code, envs=envs)
        else:
            deployment.update(code=code, envs=envs)

        db.finish_deployment(run_id=run_id, url=url)

        return {
            "code": code,
            "prompt": "",
            "url": url,
        }
    except:
        raise


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
