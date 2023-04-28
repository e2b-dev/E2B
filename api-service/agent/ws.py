from typing import Any, Dict, List
from fastapi import WebSocket

from agent.base import AgentRun


class WebsocketAgentRun(AgentRun):
    jsonrpc_version = "2.0"

    def __init__(self, websocket: WebSocket, **kwargs):
        super().__init__(**kwargs)
        self.websocket = websocket
        self.is_closed = False

    async def _notify(self, method: str, params: Dict[str, Any]):
        await self.websocket.send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "method": method,
                "params": params,
            }
        )

    async def _close(self):
        if not self.is_closed:
            self.is_closed = True
            await self.websocket.close()

    async def _call(self, id: str, method: str, params: List[Any]):
        async def handle_call():
            try:
                method_handler = getattr(self, method)
                if method_handler is None:
                    raise Exception(f"Method not found {method}")

                result = await method_handler(*params)
                return {
                    "result": result,
                }
            except Exception as e:
                print(f"Error calling {method} via JSONRPC", e)
                return {
                    "error": {
                        "code": 13,
                        "message": str(e),
                    }
                }

        response = await handle_call()
        await self.websocket.send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "id": id,
                **response,
            }
        )

    async def handle_agent_run(self):
        await self.websocket.accept()

        async for data in self.websocket.iter_json():
            await self._call(data["id"], data["method"], data.get("params", []))

        print("closed")
        await self.cancel()
