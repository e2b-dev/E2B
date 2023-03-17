import playground_client

configuration = playground_client.Configuration(
    host="http://localhost:9001",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None


class Deployment:
    def __init__(self):
        self.client = playground_client.ApiClient(configuration)
        self.api = playground_client.DefaultApi(self.client)

    def __del__(self):
        self.client.close()

    def deploy(self, project_id: str, code: str, package_json: str):
        pass
