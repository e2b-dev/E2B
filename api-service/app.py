import os
import uuid
import subprocess

from typing import Dict, List
from flask import Flask, abort, request
from flask_cors import CORS

from codegen.env import EnvVar

# from codegen import generate_req_handler
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

    db.create_deployment(run_id=run_id, project_id=project_id, route_id=route_id)

    request_body_blocks = [
        block for block in blocks if block.get("type") == "RequestBody"
    ]
    request_body_template = (
        request_body_blocks[0]["prompt"] if len(request_body_blocks) > 0 else None
    )

    # Create playground for the LLM
    playground_tools, playground = create_playground_tools(
        envs=envs,
        route=route,
        method=method,
        request_body_template=request_body_template,
    )

    # Create a new instance of code generator
    cg = Codegen.from_playground_and_database(
        playground_tools=playground_tools,
        database=db,
    )

    # Generate the code
    cg.generate(
        run_id=run_id,
        route=route,
        envs=envs,
        method=method,
        blocks=blocks,
    )

    db.update_state(run_id=run_id, state=DeploymentState.Finished)

    playground.close()

    return {
        "code": "",
        "prompt": "",
        "url": "",
    }

    ##################

    # db.create_deployment(run_id=run_id, project_id=project_id, route_id=route_id)

    # final_prompt, js_code = generate_req_handler(
    #     db=db,
    #     run_id=run_id,
    #     blocks=blocks,
    #     method=method,
    #     route=route,
    #     envs=envs,
    # )

    # db.update_state(run_id=run_id, state=DeploymentState.Deploying)

    # cf_worker_dir_path = (
    #     os.path.abspath(os.path.dirname(__file__)) + "/cf-worker-template"
    # )
    # index_js_path = cf_worker_dir_path + "/index.js"
    # wrangler_template_path = cf_worker_dir_path + "/wrangler.template.toml"
    # wrangler_path = cf_worker_dir_path + "/wrangler.toml"

    # # TODO: Inject code to cf-worker-template/index.js
    # code = js_code.strip("`").strip()
    # with open(index_js_path, "w") as file:
    #     file.write(code)

    # # Convert envs to the env vars string that looks like this:
    # # KEY_1 = VALUE_1
    # # KEY_2 = VALUE_2
    # envs_str = ""
    # for env in envs:
    #     if env["key"]:
    #         envs_str += f'{env["key"]} = "{env["value"]}"\n'
    # # TODO: Update name in cf-worker-template/wrangler.template.toml
    # replace_file_content(
    #     wrangler_template_path,
    #     wrangler_path,
    #     {"<NAME>": f'"{project_id}"', "<VARS>": envs_str},
    # )

    # # TODO: Call npm run deploy
    # cmd = ["npm", "run", "deploy", "--prefix", cf_worker_dir_path]
    # with subprocess.Popen(cmd, stdout=subprocess.PIPE) as proc:
    #     print(proc.stdout.read().decode())

    # db.update_state(run_id=run_id, state=DeploymentState.Finished)

    # api_url = f"https://{project_id}.devbook.workers.dev"
    # db.update_url(run_id=run_id, url=api_url)

    # # TODO: Report back the URL of deployed API
    # return {
    #     "code": js_code.strip("`").strip(),
    #     "prompt": final_prompt,
    #     "url": api_url,
    # }


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
