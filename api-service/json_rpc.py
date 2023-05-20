import asyncio

from typing import Any, AsyncIterator, Callable, Coroutine, Dict, List

from agent.base import AgentBase
from agent.from_template import get_agent_factory_from_template
from database import db
from agent.base import AgentInteraction, AgentInteractionRequest


class JsonRpcAgentConnection:
    jsonrpc_version = "2.0"

    def __init__(
        self,
        send_json: Callable[[Any], Coroutine[Any, Any, None]],
        iter_json: Callable[[], AsyncIterator[Any]],
        project_id: str,
    ) -> None:
        self._project_id = project_id
        self._agent: AgentBase | None = None
        self._send_json = send_json
        self._iter_json = iter_json

    async def _notify(self, method: str, params: Dict[str, Any]):
        await self._send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "method": method,
                "params": params,
            }
        )

    async def _call(self, id: str, method: str, params: Dict[str, Any] = {}):
        async def handle_call():
            try:
                print(f"Calling {method} via JSONRPC")
                match method:
                    case "start":
                        # TODO: Fix hardcoded templateID
                        params["config"]["templateID"] = "smol"
                        agent_factory = get_agent_factory_from_template(
                            params["config"]["templateID"]
                        )
                        self._agent = await agent_factory(
                            params["config"],
                            lambda: db.get_env_vars(self._project_id),
                            self._handle_logs,
                            self._handle_interaction_request,
                        )
                        print("config", params["config"])
                        await self._agent.interaction(
                            AgentInteraction(
                                type="start",
                                data={"instructions": params["instructions"]},
                            )
                        )
                    case "stop":
                        if self._agent is None:
                            raise Exception("Agent not found")
                        await self._agent.stop()
                    case "interaction":
                        if self._agent is None:
                            raise Exception("Agent not found")
                        if params is None:
                            raise Exception("Interaction params not found")
                        result = await self._agent.interaction(
                            AgentInteraction(
                                interaction_id=id,
                                data=params.get("data", None),
                                type=params["type"],
                            )
                        )
                        return {"result": result}
                    case _:
                        raise Exception(f"Method {method} not found")
            except Exception as e:
                print(f"Error calling {method} via JSONRPC", e)
                return {
                    "error": {
                        "code": 13,
                        "message": str(e),
                    }
                }

        response = await handle_call() or {"result": None}
        print(f"Sending response for {method} via JSONRPC", response)
        await self._send_json(
            {
                "jsonrpc": self.jsonrpc_version,
                "id": id,
                **response,
            }
        )

    async def close(self):
        if self._agent is not None:
            await self._agent.stop()

    async def _handle_logs(self, logs: List[Any]):
        await self._notify("logs", {"logs": logs})
        asyncio.create_task(db.update_project_developent_logs(self._project_id, logs))

    async def _handle_interaction_request(self, request: AgentInteractionRequest):
        await self._notify(
            "interaction_request",
            request.dict(),
        )

    async def handle(self):
        async for data in self._iter_json():
            await self._call(
                data["id"],
                data["method"],
                data.get("params", {}),
            )
