import os
import uuid
import subprocess

from flask import Flask, request
from flask_cors import CORS

from codegen.base import generate_req_handler
from codegen.db.base import Database, DeploymentState
from playground_client import NodeJSPlayground

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
db = Database(url, key)

app = Flask(__name__)
CORS(app)


def dump(obj):
    for attr in dir(obj):
        print("obj.%s = %r" % (attr, getattr(obj, attr)))


def replace_file_content(fp_in: str, fp_out: str, old: str, new: str) -> None:
    with open(fp_in, "rt") as fin:
        with open(fp_out, "wt") as fout:
            for line in fin:
                fout.write(line.replace(old, new))


@app.route("/health", methods=["GET"])
def health():
    return "OK"


@app.route("/generate", methods=["POST"])
def generate():
    body = request.json

    run_id = str(uuid.uuid4())
    project_id = body["projectID"]
    route_id = body["routeID"]
    blocks = body["blocks"]
    method = body["method"]
    route = body["route"]

    db.create_deployment(
        run_id=run_id, project_id=project_id, route_id=route_id)

    playground = NodeJSPlayground()

    final_prompt, js_code = generate_req_handler(
        db=db,
        playground=playground,
        run_id=run_id,
        blocks=blocks,
        method=method,
    )

    playground.close()

    db.update_state(run_id=run_id, state=DeploymentState.Deploying)

    cf_worker_dir_path = (
        os.path.abspath(os.path.dirname(__file__)) + "/cf-worker-template"
    )
    index_js_path = cf_worker_dir_path + "/index.js"
    wrangler_template_path = cf_worker_dir_path + "/wrangler.template.toml"
    wrangler_path = cf_worker_dir_path + "/wrangler.toml"

    # TODO: Inject code to cf-worker-template/index.js
    code = js_code.strip("`").strip()
    with open(index_js_path, "w") as file:
        file.write(code)

    # TODO: Update name in cf-worker-template/wrangler.template.toml
    replace_file_content(
        wrangler_template_path,
        wrangler_path,
        "<NAME>",
        f'"{project_id}"',
    )

    # TODO: Call npm run deploy
    cmd = ["npm", "run", "deploy", "--prefix", cf_worker_dir_path]
    with subprocess.Popen(cmd, stdout=subprocess.PIPE) as proc:
        print(proc.stdout.read().decode())

    db.update_state(run_id=run_id, state=DeploymentState.Finished)

    api_url = f"https://{project_id}.devbook.workers.dev"
    db.update_url(run_id=run_id, url=api_url)

    # TODO: Report back the URL of deployed API
    return {
        "code": js_code.strip("`").strip(),
        "prompt": final_prompt,
        "url": api_url,
    }


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
