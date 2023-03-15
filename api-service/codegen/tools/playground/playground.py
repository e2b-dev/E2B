import os
import time

from functools import reduce
from typing import List

import playground_client
from playground_client.models.create_mock_body_data_request import (
    CreateMockBodyDataRequest,
)
from playground_client.models.file import File
from codegen.env import EnvVar


configuration = playground_client.Configuration(
    host="http://localhost:9001",
)

# Configuration for local server
configuration.verify_ssl = False
configuration.ssl_ca_cert = None
configuration.cert_file = None


class Playground:
    port_check_interval = 1  # 1s
    max_port_checks = 10

    mock_data_filename = "index.ts"

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

    def get_open_ports(self):
        response = self.api.get_session(
            id=self.session.id,
        )
        return response.ports

    def is_port_open(self, port: float):
        open_ports = self.get_open_ports()
        return any(
            open_port.port == port and open_port.state == "LISTEN"
            for open_port in open_ports
        )

    def run_command(
        self,
        cmd: str,
        rootdir: str = "/",
        env_vars: dict[str, str] = {},
    ):
        return self.api.start_process(
            self.session.id,
            playground_client.StartProcessParams(
                cmd=cmd,
                envVars=env_vars,
                rootdir=rootdir,
            ),
            wait=True,
        )

    def start_process(
        self,
        cmd: str,
        rootdir: str = "/",
        env_vars: dict[str, str] = {},
    ):
        """Start process and return the process ID."""
        response = self.api.start_process(
            self.session.id,
            playground_client.StartProcessParams(
                cmd=cmd, envVars=env_vars, rootdir=rootdir
            ),
        )
        return response.process_id

    def stop_process(self, process_id: str):
        return self.api.stop_process(
            self.session.id,
            process_id=process_id,
            results=True,
        )

    def read_file(self, path: str):
        return self.api.read_filesystem_file(self.session.id, path).content

    def list_dir(self, path: str):
        return self.api.list_filesystem_dir(self.session.id, path).entries

    def delete_file(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def mock_body_data(self, code: str, interface: str):
        return self.api.create_mock_body_data(
            CreateMockBodyDataRequest(
                targetInterface=interface,
                files=[File(name=self.mock_data_filename, content=code)],
            )
        ).body_data

    def delete_dir(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def write_file(self, path: str, content: str):
        self.api.write_filesystem_file(
            self.session.id,
            path,
            playground_client.WriteFilesystemFileRequest(content=content),
        )

    def make_dir(self, path: str):
        self.api.make_filesystem_dir(self.session.id, path)

    def run_server_with_request(
        self,
        server_cmd: str,
        request_cmd: str,
        port: float,
        rootdir: str = "/",
        env_vars: dict[str, str] = {},
    ):
        server_process_id = self.start_process(
            cmd=server_cmd,
            rootdir=rootdir,
            env_vars=env_vars,
        )

        for _ in range(self.max_port_checks):
            if self.is_port_open(port):
                break
            time.sleep(self.port_check_interval)

        request_result = self.run_command(cmd=request_cmd, rootdir=rootdir)
        server_result = self.stop_process(server_process_id)
        return request_result, server_result

    @staticmethod
    def format_env_vars(envs: List[EnvVar]):
        return reduce(lambda acc, env: {**acc, **{env["key"]: env["value"]}}, envs, {})


class NodeJSPlayground(Playground):
    node_js_env_id = "dCeMnVVxu01L"
    rootdir = "/code"

    run_code_timeout = 5  # 5s

    default_javascript_code_file = os.path.join(rootdir, "index.js")
    default_typescript_code_file = os.path.join(rootdir, "index.ts")

    def __init__(self, envs: List[EnvVar]):
        super().__init__(NodeJSPlayground.node_js_env_id)
        self.env_vars = self.format_env_vars(envs)

    def run_javascript_code(self, code: str, timeout: float = run_code_timeout):
        print(f"Running javascript code: {code}")
        self.write_file(self.default_javascript_code_file, code)

        process_id = self.start_process(
            f"node {self.default_javascript_code_file}",
            rootdir=self.rootdir,
            env_vars=self.env_vars,
        )

        # For now we always wait the full timeout interval
        time.sleep(timeout)

        result = self.stop_process(process_id)
        print(result)
        return result

    def run_typescript_code(self, code: str, typecheck: bool = False):
        self.write_file(self.default_typescript_code_file, code)
        return self.run_command(
            f"ts-node {'-T' if typecheck else ''} {self.default_typescript_code_file}",
            rootdir=self.rootdir,
            env_vars=self.env_vars,
        )

    def check_typescript_code(self, code: str):
        self.write_file(self.default_typescript_code_file, code)
        return self.run_command(
            f"tsc {self.default_typescript_code_file} --noEmit --skipLibCheck",
            rootdir=self.rootdir,
        )

    def install_dependencies(self, dependencies: str):
        return self.run_command(f"npm install {dependencies}", rootdir=self.rootdir)

    def run_javascript_server_code_with_request(
        self,
        code: str,
        request_cmd: str,
        port: float,
    ):
        print("CALLING", code)
        self.write_file(self.default_javascript_code_file, code)
        result = self.run_server_with_request(
            server_cmd=f"node {self.default_javascript_code_file}",
            request_cmd=request_cmd,
            port=port,
            rootdir=self.rootdir,
            env_vars=self.env_vars,
        )
        print(result)
        return result

    def run_typescript_server_code_with_request(
        self,
        code: str,
        request_cmd: str,
        port: float,
    ):
        self.write_file(self.default_javascript_code_file, code)
        return self.run_server_with_request(
            server_cmd=f"ts-node {self.default_javascript_code_file}",
            request_cmd=request_cmd,
            port=port,
            rootdir=self.rootdir,
            env_vars=self.env_vars,
        )
