from typing import Callable, Coroutine, List, Any

import playground_client

from session.env import EnvVar, format_env_vars


configuration = playground_client.Configuration(
    host="http://localhost:49160",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None

GetEnvs = Callable[[], Coroutine[Any, Any, List[EnvVar]]]


class Session:
    def __init__(self, env_id: str, get_envs: GetEnvs):
        self.client = playground_client.ApiClient(configuration)
        self.api = playground_client.DefaultApi(self.client)

        result = self.api.create_sessions(
            playground_client.CreateSessionsRequest(envID=env_id),
            _request_timeout=30,
        )
        self.id = result.id
        self.is_closed = False
        self.env_vars = {}
        self.get_envs = get_envs

    def __del__(self):
        self.close()

    async def update_envs(self):
        """
        Run this each time you want to ensure the envs vars for this class are up to date.
        The self.env_vars are then used in for children methods like run_javascript_code, etc.
        """
        result = await self.get_envs()
        self.env_vars = format_env_vars(result)

    def close(self):
        if not self.is_closed:
            self.api.delete_session(self.id)
            self.is_closed = True
            self.client.close()
