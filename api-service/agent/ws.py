import pydantic

from typing import Any, Dict, List
from fastapi import WebSocket

from agent.base import AgentRun


class WebsocketAgentRun(AgentRun):
    jsonrpc_version = "2.0"

    def __init__(self, websocket: WebSocket, **kwargs):
        super().__init__(**kwargs)
        self.websocket = websocket

    class Config:
        extra = pydantic.Extra.allow

    async def _notify(self, method: str, params: Dict[str, Any]):
        await self.websocket.send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "method": method,
                "params": params,
            }
        )

    async def _call(self, id: str, method: str, params: List[Any]):
        async def handle_call():
            try:
                method_handler = getattr(self, method)
                if not method_handler:
                    raise Exception(f"Method not found {method}")

                result = await method_handler(*params)
                return {
                    "result": result,
                }
            except Exception as e:
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

    @classmethod
    async def handle_agent_run(cls, websocket: WebSocket):
        await websocket.accept()
        run = cls(websocket=websocket)

        async for data in websocket.iter_json():
            await run._call(data["id"], data["method"], data["params"])

        print("closed")
