import asyncio
import json

import websockets
from jsonrpcclient import request_json, Ok, parse_json


class RpcWebSocketClient:
    def __init__(
        self, server_url, on_open=None, on_close=None, on_message=None, on_error=None
    ):
        self.server_url = server_url
        self.websocket = None
        self.on_open = on_open
        self.on_close = on_close
        self.on_message = on_message
        self.on_error = on_error
        self.receiving = None
        self.unhandled_responses = {}

    async def connect(self):
        self.websocket = await websockets.connect(self.server_url)
        self.receiving = asyncio.create_task(self.receive_message())
        if self.on_open:
            await self.on_open()

    async def send_message(self, message, *params):
        request = request_json(message, list(params))
        await self.websocket.send(request)
        request_with_id = json.loads(request)
        return await self.wait_for_response(request_with_id["id"])

    async def wait_for_response(self, id):
        while True:
            if id in self.unhandled_responses:
                response = self.unhandled_responses.pop(id)
                if isinstance(response, Exception):
                    raise response
                return response
            await asyncio.sleep(0.1)

    async def receive_message(self):
        while True:
            response = await self.websocket.recv()
            if isinstance(response, Ok):
                data = parse_json(response)
                if id := getattr(data, "id"):
                    self.unhandled_responses[id] = response
                else:
                    self.on_message(response)
            else:
                try:
                    id = getattr(parse_json(response), "id")
                    self.unhandled_responses[id] = Exception(response)
                except:
                    raise Exception(response)

    async def close(self):
        await self.websocket.close()
        self.receiving.cancel()
        if self.on_close:
            await self.on_close()
