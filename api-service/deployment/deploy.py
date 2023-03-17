from codegen.env import EnvVar
import playground_client
from playground_client.models.create_deployment_request import CreateDeploymentRequest

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
        self.session = self.api.create_sessions(
            playground_client.CreateSessionsRequest(envID=env_id)
        )
        self.is_closed = False

    def __del__(self):
        self.close()

    def close(self):
        if not self.is_closed:
            self.api.delete_session(self.session.id)
            self.is_closed = True
            self.client.close()


class Deployment:
    def __init__(self):
        self.client = playground_client.ApiClient(configuration)
        self.api = playground_client.DefaultApi(self.client)

    def __del__(self):
        self.client.close()

    def deploy(self, project_id: str, code: str, env_vars: EnvVar):
        result = self.api.create_deployment(
            CreateDeploymentRequest(
                project_id=project_id,
                envVars=env_vars,
                code=code,
            )
        )
        pass
