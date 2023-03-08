import requests
import os


if os.environ.get("ENV") == "dev":
    url = "http://localhost:3000/api/exec/js"
else:
    url = "https://ai-api-gray.vercel.app/api/exec/js"


def eval(code: str):
    json = {
        "code": code,
    }

    resp = requests.post(url=url, json=json)
    resp_json = resp.json()

    if "message" in json:
        return resp_json["message"]
    return ""
