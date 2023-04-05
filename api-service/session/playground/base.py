import time
import math
from typing import Any

from playground_client.models.list_filesystem_dir_response import (
    ListFilesystemDirResponse,
)
from playground_client.models.process_response import ProcessResponse
from playground_client.models.read_filesystem_file_response import (
    ReadFilesystemFileResponse,
)
from playground_client.models.session_response import SessionResponse
import playground_client
from session.env import cmd_with_env_vars
from session.session import GetEnvs, Session


class Playground(Session):
    port_check_interval = 0.5  # 500ms
    max_port_checks = 10

    rootdir = "/"

    run_command_timeout_frequency = 2  # in Hz

    def __init__(self, env_id: str, get_envs: GetEnvs):
        super().__init__(env_id, get_envs)

    async def get_open_ports(self):
        thread: Any = self.api.get_session(self.id, async_req=True)
        response: SessionResponse = thread.get()
        return response.ports

    async def is_port_open(self, port: float) -> bool:
        open_ports = await self.get_open_ports()
        return any(
            open_port.port == port and open_port.state == "LISTEN"
            for open_port in open_ports
        )

    async def run_command(
        self,
        cmd: str,
        rootdir=rootdir,
        timeout: float | None = None,
    ):
        thread: Any = self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd_with_env_vars(cmd, self.env_vars),
                # TODO: Env vars are not correctly passed to the devbookd process - that's why we add them with cmd_with_env_vars.
                envVars=self.env_vars,
                rootdir=rootdir,
            ),
            wait=True if timeout is None else False,
            async_req=True,
        )

        response: ProcessResponse = thread.get()

        if timeout is None or response.finished:
            return response

        # Multiply the timeout by the frequency so when we sleep for the 1/frequency the total time sleeping will be the timeout.
        for _ in range(math.ceil(timeout * self.run_command_timeout_frequency)):
            thread = self.api.get_process(
                self.id,
                process_id=response.process_id,
                async_req=True,
            )

            response: ProcessResponse = thread.get()

            if response.finished:
                return response
            time.sleep(1 / self.run_command_timeout_frequency)

        if not response.finished:
            thread: Any = self.api.stop_process(
                self.id,
                process_id=response.process_id,
                results=False,
                async_req=True,
            )
            thread.get()

        return response

    async def start_process(
        self,
        cmd: str,
        rootdir=rootdir,
    ):
        """Start process and return the process ID."""
        thread: Any = self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd_with_env_vars(cmd, self.env_vars),
                # TODO: Env vars are not correctly passed to the devbookd process - that's why we add them with cmd_with_env_vars.
                envVars=self.env_vars,
                rootdir=rootdir,
            ),
            async_req=True,
        )

        response: ProcessResponse = thread.get()
        return response.process_id

    async def stop_process(self, process_id: str):
        thread: Any = self.api.stop_process(
            self.id,
            process_id=process_id,
            results=True,
            async_req=True,
        )

        response: ProcessResponse = thread.get()
        return response

    async def read_file(self, path: str):
        thread: Any = self.api.read_filesystem_file(self.id, path, async_req=True)
        response: ReadFilesystemFileResponse = thread.get()
        return response.content

    async def list_dir(self, path: str):
        thread: Any = self.api.list_filesystem_dir(self.id, path, async_req=True)
        response: ListFilesystemDirResponse = thread.get()
        return response.entries

    async def delete_file(self, path: str):
        thread: Any = self.api.delete_filesystem_entry(self.id, path, async_req=True)
        thread.get()

    async def delete_dir(self, path: str):
        thread: Any = self.api.delete_filesystem_entry(self.id, path, async_req=True)
        thread.get()

    async def write_file(self, path: str, content: str):
        thread: Any = self.api.write_filesystem_file(
            self.id,
            path,
            playground_client.WriteFilesystemFileRequest(content=content),
            async_req=True,
        )
        thread.get()

    async def make_dir(self, path: str):
        thread: Any = self.api.make_filesystem_dir(self.id, path, async_req=True)
        thread.get()

    async def run_server_with_request(
        self,
        server_cmd: str,
        request_cmd: str,
        port: float,
        rootdir=rootdir,
    ):
        server_process_id = await self.start_process(
            cmd=server_cmd,
            rootdir=rootdir,
        )

        for _ in range(self.max_port_checks):
            if await self.is_port_open(port):
                break
            time.sleep(self.port_check_interval)

        request_result = await self.run_command(cmd=request_cmd, rootdir=rootdir)
        server_result = await self.stop_process(server_process_id)
        return request_result, server_result
