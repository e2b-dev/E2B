import asyncio

from multiprocessing.pool import ApplyResult
from typing import Callable, Coroutine, List, Any

import playground_client
from playground_client.models.session_response import SessionResponse

from session.env import EnvVar, format_env_vars


configuration = playground_client.Configuration(
    host="http://localhost:49160",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None

GetEnvs = Callable[[], Coroutine[Any, Any, List[EnvVar]]]


async def get_result(result: ApplyResult[Any]):
    while not result.ready():
        await asyncio.sleep(0.5)  # give other tasks chance to run

    return result.get()


class Session:
    def __init__(self, env_id: str, get_envs: GetEnvs):
        self.client = playground_client.ApiClient(configuration, pool_threads=3)
        self.api = playground_client.DefaultApi(self.client)
        self.env_id = env_id
        self.is_closed = False
        self.env_vars = {}
        self.get_envs = get_envs
        self.id: str = ""

    async def open(self):
        thread: ApplyResult[Any] = self.api.create_sessions(
            playground_client.CreateSessionsRequest(envID=self.env_id),
            _request_timeout=10,
            async_req=True,
        )  # type: ignore

        response: SessionResponse = await get_result(thread)
        self.id = response.id

    async def update_envs(self):
        """
        Run this each time you want to ensure the envs vars for this class are up to date.
        The self.env_vars are then used in for children methods like run_javascript_code, etc.
        """
        result = await self.get_envs()
        self.env_vars = format_env_vars(result)

    async def close(self):
        if not self.is_closed and self.id is not None:
            thread: Any = self.api.delete_session(self.id, async_req=True)
            await get_result(thread)
            self.is_closed = True
            self.client.close()
