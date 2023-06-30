import math

from multiprocessing.pool import ApplyResult
from typing import Any, List
from asyncio import sleep

from playground_client.models.entry_info import EntryInfo
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
from session.session import GetEnvs, Session, get_result


class Playground(Session):
    port_check_interval = 0.5  # 500ms
    max_port_checks = 10

    run_command_timeout_frequency = 1  # in Hz

    def __init__(self, env_id: str, get_envs: GetEnvs, rootdir="/"):
        super().__init__(env_id, get_envs)
        self.rootdir = rootdir

    async def get_open_ports(self):
        thread: Any = self.api.get_session(self.id, async_req=True)
        response: SessionResponse = await get_result(thread)
        return response.ports

    async def is_port_open(self, port: float) -> bool:
        open_ports = await self.get_open_ports()
        return any(
            open_port.port == port and open_port.state == "LISTEN"
            for open_port in open_ports
        )

    async def sync_clock(self):
        await self.run_command(
            "rc-service chronyd stop && chronyd -q 'server pool.ntp.org iburst'"
        )

    async def install_deps(self, rootdir: str):
        await self.run_command("apk add npm")
        await self.run_command(f"npm install --prefix {rootdir}", rootdir="/")

    async def clone_repo(
        self,
        repo_address: str,
        branch: str,
        rootdir: str,
    ):
        await self.make_dir(rootdir)
        res = await self.run_command(
            f"git clone --depth 1 --branch {branch} {repo_address} {rootdir}",
            rootdir="/",
        )
        print("Repo clone result", res)

    async def push_repo(
        self,
        repo_address: str,
        rootdir: str,
        commit_message: str,
        git_email: str,
        git_name: str,
    ):
        res = await self.run_command(
            (
                f"cd {rootdir} && "
                f'git config --global user.email "{git_email}" && '
                f'git config --global user.name "{git_name}" && '
                f"git config --global push.autoSetupRemote true && "
                f"git add . && "
                f'git commit -m "{commit_message}" && '
                f"git push {repo_address}"
            ),
            rootdir=rootdir,
        )
        print("Repo push result", res)

    async def change_rootdir(self, rootdir: str):
        self.rootdir = rootdir

    async def get_filenames(
        self,
        path: str,
        ignore: List[str] = [],
    ):
        dirs: List[EntryInfo] = [EntryInfo(name=path, isDir=True)]
        files: List[EntryInfo] = []
        while len(dirs) > 0:
            dir = dirs.pop()
            entries = await self.list_dir(dir.name)
            dirs.extend(
                EntryInfo(isDir=True, name=f"{dir.name}/{entry.name}")
                for entry in entries
                if entry.is_dir and not entry.name in ignore
            )
            files.extend(
                EntryInfo(isDir=False, name=f"{dir.name}/{entry.name}")
                for entry in entries
                if not entry.is_dir and not entry.name in ignore
            )
        return files

    async def get_files(
        self,
        path: str,
        ignore: List[str] = [],
    ):
        files = await self.get_filenames(path, ignore)
        for file in files:
            try:
                content = await self.read_file(file.name)
                yield (file.name, content)
            except:
                print("Skipping file", file.name)
                continue

    async def run_command(
        self,
        cmd: str,
        rootdir: str | None = None,
        timeout: float | None = None,
    ):
        thread: ApplyResult[ProcessResponse]

        thread = self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd_with_env_vars(cmd, self.env_vars),
                # TODO: Env vars are not correctly passed to the devbookd process - that's why we add them with cmd_with_env_vars.
                envVars=self.env_vars,
                rootdir=rootdir or self.rootdir,
            ),
            wait=True if timeout is None else False,
            async_req=True,
        )  # type: ignore

        response: ProcessResponse = await get_result(thread)

        if timeout is None or response.finished:
            return response

        # Multiply the timeout by the frequency so when we sleep for the 1/frequency the total time sleeping will be the timeout.
        for _ in range(math.ceil(timeout * self.run_command_timeout_frequency)):
            thread = self.api.get_process(
                self.id,
                process_id=response.process_id,
                async_req=True,
            )  # type: ignore

            response: ProcessResponse = await get_result(thread)

            if response.finished:
                return response
            await sleep(1 / self.run_command_timeout_frequency)

        if not response.finished:
            thread = self.api.stop_process(
                self.id,
                process_id=response.process_id,
                results=False,
                async_req=True,
            )  # type: ignore
            await get_result(thread)

        return response

    async def start_process(
        self,
        cmd: str,
        rootdir: str | None = None,
    ):
        """Start process and return the process ID."""
        thread: Any = self.api.start_process(
            self.id,
            playground_client.StartProcessParams(
                cmd=cmd_with_env_vars(cmd, self.env_vars),
                # TODO: Env vars are not correctly passed to the devbookd process - that's why we add them with cmd_with_env_vars.
                envVars=self.env_vars,
                rootdir=rootdir or self.rootdir,
            ),
            async_req=True,
        )

        response: ProcessResponse = await get_result(thread)
        return response.process_id

    async def stop_process(self, process_id: str):
        thread: Any = self.api.stop_process(
            self.id,
            process_id=process_id,
            results=True,
            async_req=True,
        )

        response: ProcessResponse = await get_result(thread)
        return response

    async def read_file(self, path: str):
        thread: Any = self.api.read_filesystem_file(self.id, path, async_req=True)
        response: ReadFilesystemFileResponse = await get_result(thread)
        return response.content

    async def list_dir(self, path: str):
        thread: Any = self.api.list_filesystem_dir(self.id, path, async_req=True)
        response: ListFilesystemDirResponse = await get_result(thread)
        return response.entries

    async def delete_file(self, path: str):
        thread: Any = self.api.delete_filesystem_entry(self.id, path, async_req=True)
        await get_result(thread)

    async def delete_dir(self, path: str):
        thread: Any = self.api.delete_filesystem_entry(self.id, path, async_req=True)
        await get_result(thread)

    async def write_file(self, path: str, content: str):
        print("Writing file", path, content)
        thread: Any = self.api.write_filesystem_file(
            self.id,
            path,
            playground_client.WriteFilesystemFileRequest(content=content),
            async_req=True,
        )
        await get_result(thread)

    async def make_dir(self, path: str):
        thread: Any = self.api.make_filesystem_dir(self.id, path, async_req=True)
        await get_result(thread)

    async def run_server_with_request(
        self,
        server_cmd: str,
        request_cmd: str,
        port: float,
        rootdir: str | None = None,
    ):
        server_process_id = await self.start_process(
            cmd=server_cmd,
            rootdir=rootdir or self.rootdir,
        )

        for _ in range(self.max_port_checks):
            if await self.is_port_open(port):
                break
            await sleep(self.port_check_interval)

        request_result = await self.run_command(
            cmd=request_cmd,
            rootdir=rootdir or self.rootdir,
        )
        server_result = await self.stop_process(server_process_id)
        return request_result, server_result
