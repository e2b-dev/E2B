from typing import List

import playground_client

from session.env import EnvVar, format_env_vars


configuration = playground_client.Configuration(
    host="http://localhost:9001",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None


class Session:
    def __init__(self, env_id: str):
        self.client = playground_client.ApiClient(configuration)
        self.api = playground_client.DefaultApi(self.client)

        result = self.api.create_sessions(
            playground_client.CreateSessionsRequest(envID=env_id)
        )
        self.id = result.id
        self.is_closed = False

    def __del__(self):
        self.close()

    def close(self):
        if not self.is_closed:
            self.api.delete_session(self.id)
            self.is_closed = True
            self.client.close()

    def deploy(self, project_id: str, envs: List[EnvVar]):
        return self.api.create_deployment(
            project_id=project_id,
            session_id=self.id,
            create_deployment_request=playground_client.CreateDeploymentRequest(
                envVars=format_env_vars(envs),
            ),
        ).url
