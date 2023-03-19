import pprint
import os

from typing import List

from session.env import EnvVar
from session.playground import Playground


class NodeJSPlayground(Playground):
    node_js_env_id = "dCeMnVVxu01L"
    rootdir = "/code"
    default_javascript_code_file = os.path.join(rootdir, "index.js")
    run_code_timeout = 5  # 5s

    def __init__(self, envs: List[EnvVar]):
        super().__init__(NodeJSPlayground.node_js_env_id, envs)

    def run_javascript_code(self, code: str):
        # print(f"Running javascript code...")
        self.write_file(self.default_javascript_code_file, code)
        result = self.run_command(
            f"node {self.default_javascript_code_file}",
            rootdir=self.rootdir,
            timeout=self.run_code_timeout,
        )
        # pprint.pprint(f"Result: {result}")
        return result

    def install_dependencies(self, dependencies: str):
        # print(f"Installing dependencies: {dependencies}")
        result = self.run_command(f"npm install {dependencies}", rootdir=self.rootdir)
        # pprint.pprint(f"Result: {result}")
        return result

    def run_javascript_server_code_with_request(
        self,
        code: str,
        request_cmd: str,
        port: float,
    ):
        # print(f"Running '{request_cmd}' for code:\n{code}")
        self.write_file(self.default_javascript_code_file, code)
        result = self.run_server_with_request(
            server_cmd=f"node {self.default_javascript_code_file}",
            request_cmd=request_cmd,
            port=port,
            rootdir=self.rootdir,
        )
        # pprint.pprint(f"Result: {result}")
        return result
