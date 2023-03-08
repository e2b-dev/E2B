import os
from api_service.aicode.base import generate_req_handler
# from api_service.aicode import generate_req_handler
from flask import Flask, request
from dotenv import load_dotenv
load_dotenv()
print(os.environ)

app = Flask(__name__)


@app.route("/generate", methods=['POST'])
def generate():
    body = request.json

    project_id = body['projectId']
    blocks = body['blocks']
    method = body['method']

    final_prompt, js_code = generate_req_handler(
        project_id=project_id, blocks=blocks, method=method)
    print(js_code)
    return {'code': js_code.strip('`').strip(), 'prompt': final_prompt}


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
