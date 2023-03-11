import openapi_client

from enum import Enum
from typing import TypedDict, Union


configuration = openapi_client.Configuration(
    host = 'https://localhost:9001',
)

class FilesystemEntryType(Enum):
    FILE = 'file'
    DIR = 'directory'

class FilesystemEntry(TypedDict):
    name: str
    type: FilesystemEntryType

class CommandOutput(TypedDict):
    error: Union[str, None]
    output: str

class Playground:
    def __init__(self, env_id: str):
        self.client = openapi_client.ApiClient(configuration)
        self.api = openapi_client.DefaultApi(self.client)
        self.session = self.api.create_session(openapi_client.CreateSessionParams(env_id))
        self.is_closed = False

    def __del__(self):
        self.close()

    def close(self):
        if not self.is_closed:
            self.is_closed = True
            self.api.delete_session(self.session.id)
            self.client.close()

    def run_command(self, cmd: str):
        result = self.api.run_process(self.session.id, openapi_client.RunProcessParams(cmd))
        err_lines = [err.line for err in result.stderr]
        out_lines = [out.line for out in result.stdout]

        return CommandOutput(
            error=err_lines.join('\n') if len(err_lines) > 0 else None,
            output='\n'.join(out_lines)
        )

    def read_file(self, path: str):
        result = self.api.read_filesystem_file(self.session.id, path)
        return result.content

    def list_dir(self, path: str):
        result = self.api.list_filesystem_dir(self.session.id, path)
        return [
            FilesystemEntry(
                name=entry.name,
                type=FilesystemEntryType.DIR if entry.is_dir else FilesystemEntryType.FILE
            ) 
            for entry in result.entries
        ]

    def delete_file(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def delete_dir(self, path: str):
        self.api.delete_filesystem_entry(self.session.id, path)

    def write_file(self, path: str, content: str):
        self.api.write_filesystem_file(self.session.id, path, openapi_client.WriteFilesystemFileParams(content))

    def make_dir(self, path: str):
        self.api.make_filesystem_dir(self.session.id, path)


class NodeJSPlayground(Playground):
    node_js_env_id = 'rVGhg9SdIzZ2'
    default_code_file = 'index.js'

    def __init__(self):
        super().__init__(NodeJSPlayground.node_js_env_id)

    def run_code(self, code: str):
        self.write_file(self.default_code_file, code)
        return self.run_command(f'node {self.default_code_file}')
