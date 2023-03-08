import requests

# url = 'http://localhost:3000/api/exec/js'
url = 'https://ai-api-gray.vercel.app/api/exec/js'


def eval(code: str):
    json = {
        'code': code,
    }
    resp = requests.post(url=url, json=json)
    json = resp.json()
    if 'message' in json:
        return json['message']
    return ''
