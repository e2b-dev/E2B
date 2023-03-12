import playground_client


configuration = playground_client.Configuration(
    host="http://localhost:9001",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None


class Playground:
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
            self.is_closed = True
            self.api.delete_session(self.session.id)
            self.client.close()

    def run_command(self, cmd: str, env_vars = {}):
        return self.api.run_process(
            self.session.id, playground_client.RunProcessParams(cmd=cmd, envVars=env_vars)
        )

    def read_file(self, path: str):
        return self.api.read_filesystem_file(self.session.id, path).content

    def list_dir(self, path: str):
        return self.api.list_filesystem_dir(self.session.id, path).entries

    def delete_file(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def delete_dir(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def write_file(self, path: str, content: str):
        self.api.write_filesystem_file(
            self.session.id, path, playground_client.WriteFilesystemFileRequest(content=content)
        )

    def make_dir(self, path: str):
        self.api.make_filesystem_dir(self.session.id, path)


class NodeJSPlayground(Playground):
    node_js_env_id = "KctyCCI7Ijf9"

    default_javascript_code_file = "index.js"
    default_typescript_code_file = "index.ts"

    def __init__(self):
        super().__init__(NodeJSPlayground.node_js_env_id)

    def run_javascript_code(self, code: str):
        self.write_file(self.default_javascript_code_file, code)
        return self.run_command(f"node {self.default_javascript_code_file}")

    def run_typescript_code(self, code: str):
        self.write_file(self.default_typescript_code_file, code)
        return self.run_command(f"ts-node -T {self.default_typescript_code_file}")

    def check_typescript_code(self, code: str):
        self.write_file(self.default_typescript_code_file, code)
        return self.run_command(
            f"tsc {self.default_typescript_code_file} --noEmit --skipLibCheck"
        )

    def install_dependencies(self, dependencies: str):
        return self.run_command(f"npm install {dependencies}")

    # TODO: How to handle endless run_commands?
    # If we actually run express server, the process will never end.
    # Can we somehow start server and make a request so we check if it works? This is tests, right?
