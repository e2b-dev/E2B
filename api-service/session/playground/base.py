import time
import math
from typing import List
from session.env import EnvVar, format_env_vars

from session.session import Session
from playground_client.models.create_mock_body_data_request import (
    CreateMockBodyDataRequest,
)
import playground_client
from playground_client.models.file import File


class Playground(Session):
    port_check_interval = 1  # 1s
    max_port_checks = 10

    run_command_timeout_frequency = 2  # in Hz

    mock_data_filename = "index.ts"

    def __init__(self, env_id: str, envs: List[EnvVar]):
        super().__init__(env_id)
        self.env_vars = format_env_vars(envs)

    def get_open_ports(self):
        response = self.api.get_session(self.id)
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
        rootdir="/",
        timeout: float | None = None,
    ):
        response = self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd,
                envVars=self.env_vars,
                rootdir=rootdir,
            ),
            wait=True if timeout is None else False,
        )

        if timeout is None or response.finished:
            return response

        # Multiply the timeout by the frequency so when we sleep for the 1/frequency the total time sleeping will be the timeout.
        for _ in range(math.ceil(timeout * self.run_command_timeout_frequency)):
            response = self.api.get_process(
                self.id,
                process_id=response.process_id,
            )
            if response.finished:
                return response
            time.sleep(1 / self.run_command_timeout_frequency)

        if not response.finished:
            self.api.stop_process(
                self.id,
                process_id=response.process_id,
                results=False,
            )

        return response

    def start_process(
        self,
        cmd: str,
        rootdir="/",
    ):
        """Start process and return the process ID."""
        return self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd,
                envVars=self.env_vars,
                rootdir=rootdir,
            ),
        ).process_id

    def stop_process(self, process_id: str):
        return self.api.stop_process(
            self.id,
            process_id=process_id,
            results=True,
        )

    def read_file(self, path: str):
        return self.api.read_filesystem_file(self.id, path).content

    def list_dir(self, path: str):
        return self.api.list_filesystem_dir(self.id, path).entries

    def delete_file(self, path: str):
        self.api.delete_filesystem_entry(self.id, path)

    def mock_body_data(self, code: str, interface: str):
        return self.api.create_mock_body_data(
            CreateMockBodyDataRequest(
                targetInterface=interface,
                files=[File(name=self.mock_data_filename, content=code)],
            )
        ).body_data

    def delete_dir(self, path: str):
        self.api.delete_filesystem_entry(self.id, path)

    def write_file(self, path: str, content: str):
        self.api.write_filesystem_file(
            self.id,
            path,
            playground_client.WriteFilesystemFileRequest(content=content),
        )

    def make_dir(self, path: str):
        self.api.make_filesystem_dir(self.id, path)

    def run_server_with_request(
        self,
        server_cmd: str,
        request_cmd: str,
        port: float,
        rootdir="/",
    ):
        server_process_id = self.start_process(
            cmd=server_cmd,
            rootdir=rootdir,
        )

        for _ in range(self.max_port_checks):
            if self.is_port_open(port):
                break
            time.sleep(self.port_check_interval)

        request_result = self.run_command(cmd=request_cmd, rootdir=rootdir)
        server_result = self.stop_process(server_process_id)
        return request_result, server_result
