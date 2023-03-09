import os
from codegen.base import generate_req_handler
from flask import Flask, request
from flask_cors import CORS
import CloudFlare
import json
import requests
import time


def dump(obj):
    for attr in dir(obj):
        print("obj.%s = %r" % (attr, getattr(obj, attr)))


cf_email = os.environ["CLOUDFLARE_EMAIL"]
cf_api_key = os.environ["CLOUDFLARE_API_KEY"]
# cf_api_cert = os.environ["CLOUDFLARE_API_CERTKEY"]

# cf = CloudFlare.CloudFlare(
#     email=cf_email, key=cf_api_key, certtoken=cf_api_cert, debug=False
# )

cf_token = os.environ.get("CLOUDFLARE_API_TOKEN")
cf = CloudFlare.CloudFlare(debug=True)

cf_acc_id = os.environ.get("CLOUDFLARE_ACC_ID")

# ws = cf.accounts.workers.scripts.get(cf_acc_id)
# print(ws)

data = {
    "index.js": str.encode(
        """export default {{
  async fetch(request) {{
    return new Response("Hello World!");
  }},
}};"""
    ),
    "metadata": {"main_module": "index.js"},
}

js_code = str.encode(
    """
module.exports = {{
  async fetch(request) {{
    return new Response("Hello World!", {{ headers: {{'Content-Type': 'text/html'}} }});
  }},
}};
"""
)

script_name = "my_script_new"

cf_url = "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/services/{script_name}/environments/production".format(
    account_id=cf_acc_id, script_name=script_name
)
headers = {
    "X-Auth-Email": cf_email,
    "X-Auth-Key": cf_api_key,
}
# >>>>>>>>> THIS WORKS
response = requests.put(
    cf_url,
    headers=headers,
    files={
        "worker.js": (
            "worker.js",
            open("worker.js", "rb"),
            "application/javascript+module",
        ),
        "metadata": (
            None,
            str.encode('{"bindings": [], "main_module": "worker.js"}'),
            "application/json",
        ),
    },
)
# response = requests.put(
#     cf_url,
#     headers=headers,
#     files={
#         "index.js": str.encode(
#             """export default {{
#   async fetch(request) {{
#     return new Response("Hello World!");
#   }},
# }};"""
#         )
#     },
# )
print("RESPONSE 1")
print(response.request.headers)
print(response.content)
print(response.json())

# Enable subdomain, eg: https://my_script.devbook.workers.dev/
time.sleep(5)
zone_id = "72aff3fa4f548f5fc3bbcc223037f444"
cf_url = "https://api.cloudflare.com/client/v4/zones/{zone_id}/workers/routes".format(
    zone_id=zone_id
)
print(cf_url)
response = requests.post(
    cf_url,
    headers=headers,
    json={
        "pattern": "{script_name}.devbook.workers.dev".format(script_name=script_name),
        "script": script_name,
    },
)
# response = requests.post(cf_url, headers=headers, json={"enabled": "true"})
print("RESPONSE 2")
print(response.request.headers)
# print(response.content)
print(response.json())


app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    return "OK"


@app.route("/generate", methods=["POST"])
def generate():
    body = request.json

    project_id = body["projectId"]
    blocks = body["blocks"]
    method = body["method"]

    final_prompt, js_code = generate_req_handler(
        project_id=project_id, blocks=blocks, method=method
    )

    return {"code": js_code.strip("`").strip(), "prompt": final_prompt}


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
