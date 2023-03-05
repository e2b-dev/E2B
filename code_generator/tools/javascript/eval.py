import requests

url = 'http://localhost:3000/api/exec/js'


def eval(code: str):
    json = {
        'code': code,
    }
    resp = requests.post(url=url, json=json)
    data = resp.json()
    print(data)
