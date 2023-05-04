from typing import Any, AsyncIterator, Callable, Coroutine, Dict
from pydantic import BaseModel
from pydantic.fields import PrivateAttr

from agent.base import AgentConfig, AgentInteraction, AgentBase
from agent.basic_agent import BasicAgent


class JsonRpcAgentConnector(BaseModel):
    jsonrpc_version = "2.0"

    agent: AgentBase | None = None
    agent_factory: Callable[[AgentConfig], Coroutine[None, None, AgentBase]]

    send_json: Callable[[Any], Coroutine[Any, Any, None]]
    iter_json: Callable[[], AsyncIterator[Any]]

    async def _notify(self, method: str, params: Dict[str, Any]):
        await self.send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "method": method,
                "params": params,
            }
        )

    async def _call(self, id: str, method: str, params: Dict[str, Any] | None):
        async def handle_call():
            try:
                print(f"Calling {method} via JSONRPC")
                match method:
                    case "start":
                        if self.agent is None:
                            raise Exception("Agent not found")
                        await self.agent.start(params and params.get("data"))
                        return {}

                    case "stop":
                        if self.agent is None:
                            raise Exception("Agent not found")
                        await self.agent.stop()
                        return {}
                    case "interaction":
                        if self.agent is None:
                            raise Exception("Agent not found")
                        if params is None:
                            raise Exception("Interaction params not found")
                        result = await self.agent.interaction(
                            AgentInteraction(
                                interaction_id=id,
                                data=params["data"],
                                type=params["type"],
                            )
                        )
                        return {"result": result}
                    case default:
                        raise Exception(f"Method {method} not found")
            except Exception as e:
                print(f"Error calling {method} via JSONRPC", e)
                return {
                    "error": {
                        "code": 13,
                        "message": str(e),
                    }
                }

        response = await handle_call()
        await self.send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "id": id,
                **response,
            }
        )

    async def close(self):
        if self.agent is not None:
            await self.agent.stop()

    async def handle(self):
        self.agent = await self.agent_factory(
            AgentConfig(
                on_logs=lambda logs, project_id: self._notify("log", {"log": log}),
                on_interaction_request=lambda request: self._notify(
                    "interaction_request", {"request": request}
                ),
                on_close=lambda: self.close,
            )
        )

        async for data in self.iter_json():
            await self._call(
                data["id"],
                data["method"],
                data.get("params", {}),
            )
