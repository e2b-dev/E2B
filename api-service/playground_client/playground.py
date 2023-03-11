from enum import Enum
from typing import TypedDict, Union

from openapi_client import ApiClient, DefaultApi, Configuration
from openapi_client import CreateSessionParams, RunProcessParams, WriteFilesystemFileParams

configuration = Configuration(
    host="https://localhost:9001",
)


class FilesystemEntryType(Enum):
    FILE = "file"
    DIR = "directory"


class FilesystemEntry(TypedDict):
    name: str
    type: FilesystemEntryType


class CommandOutput(TypedDict):
    error: Union[str, None]
    output: str


class Playground:
    def __init__(self, env_id: str):
        self.client = ApiClient(configuration)
        self.api = DefaultApi(self.client)
        self.session = self.api.create_session(
            CreateSessionParams(env_id)
        )
        self.is_closed = False

    def __del__(self):
        self.close()

    def close(self):
        if not self.is_closed:
            self.is_closed = True
            self.api.delete_session(self.session.id)
            self.client.close()

    def run_command(self, cmd: str):
        result = self.api.run_process(
            self.session.id, RunProcessParams(cmd)
        )
        err_lines = [err.line for err in result.stderr]
        out_lines = [out.line for out in result.stdout]

        return CommandOutput(
            error=err_lines.join("\n") if len(err_lines) > 0 else None,
            output="\n".join(out_lines),
        )

    def read_file(self, path: str):
        result = self.api.read_filesystem_file(self.session.id, path)
        return result.content

    def list_dir(self, path: str):
        result = self.api.list_filesystem_dir(self.session.id, path)
        return [
            FilesystemEntry(
                name=entry.name,
                type=FilesystemEntryType.DIR
                if entry.is_dir
                else FilesystemEntryType.FILE,
            )
            for entry in result.entries
        ]

    def delete_file(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def delete_dir(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def write_file(self, path: str, content: str):
        self.api.write_filesystem_file(
            self.session.id, path, WriteFilesystemFileParams(content)
        )

    def make_dir(self, path: str):
        self.api.make_filesystem_dir(self.session.id, path)


class NodeJSPlayground(Playground):
    # TODO: Check if node 18 is used
    node_js_env_id = "rVGhg9SdIzZ2"

    default_javascript_code_file = "index.js"
    default_typescript_code_file = "index.ts"

    def __init__(self):
        super().__init__(NodeJSPlayground.node_js_env_id)

    def run_javascript_code(self, code: str):
        self.write_file(self.default_javascript_code_file, code)
        return self.run_command(f"node {self.default_javascript_code_file}")

    # TODO: Install `ts-node` in the env
    def run_typescript_code(self, code: str):
        self.write_file(self.default_typescript_code_file, code)
        return self.run_command(f"ts-node {self.default_typescript_code_file}")

    # TODO: Install `tsc` in the env
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
