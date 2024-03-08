import binascii
import json
import os
import time
import uuid
from time import sleep
from typing import Optional, Callable, Any, List, Union, Literal

import requests
from pydantic import BaseModel
from websocket import create_connection

from e2b import Sandbox, EnvVars, ProcessMessage, OpenPort
from e2b.constants import TIMEOUT


class Error(BaseModel):
    name: str
    value: str
    traceback: List[str]


class Result(BaseModel):
    output: Optional[str] = None
    stdout: List[str] = []
    stderr: List[str] = []
    error: Optional[Error] = None
    # TODO: This will be changed in the future, it's just to enable the use of display_data
    display_data: List[dict] = []


class CodeInterpreterV2(Sandbox):
    template = "code-interpreter-stateful"

    def __init__(
        self,
        template: Optional[str] = None,
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        timeout: Optional[float] = TIMEOUT,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        **kwargs,
    ):
        super().__init__(
            template=template or self.template,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            timeout=timeout,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            **kwargs,
        )

        if not kwargs.get("_sandbox"):
            self._jupyter_server_token = binascii.hexlify(os.urandom(24)).decode("ascii")
            self._jupyter_kernel_id = self._start_jupyter()

    def _start_jupyter(self) -> str:
        self.process.start(
            f"jupyter server --IdentityProvider.token={self._jupyter_server_token}"
        )

        url = f"{self.get_protocol()}://{self.get_hostname(8888)}"
        headers = {"Authorization": f"Token {self._jupyter_server_token}"}

        response = requests.get(f"{url}/api", headers=headers)
        while response.status_code != 200:
            sleep(0.2)
            response = requests.get(f"{url}/api", headers=headers)

        response = requests.post(f"{url}/api/kernels", headers=headers)
        if response.status_code != 201:
            raise Exception(f"Error creating kernel: {response.status_code}")

        kernel = json.loads(response.text)

        self.filesystem.make_dir("/root/.jupyter")
        self.filesystem.write("/root/.jupyter/config.json", json.dumps({"token": self._jupyter_server_token, "kernel_id": kernel["id"]}))
        return kernel["id"]

    @classmethod
    def reconnect(
        cls,
        sandbox_id: str,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Union[Callable[[int], Any], Callable[[], Any]]] = None,
        timeout: Optional[float] = TIMEOUT,
        api_key: Optional[str] = None,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        sandbox = super().reconnect(
            sandbox_id=sandbox_id,
            cwd=cwd,
            env_vars=env_vars,
            on_scan_ports=on_scan_ports,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            timeout=timeout,
            api_key=api_key,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        data = json.loads(sandbox.filesystem.read("/root/.jupyter/config.json"))
        sandbox._jupyter_server_token = data["token"]
        sandbox._jupyter_kernel_id = data["kernel_id"]
        return sandbox

    def _connect_kernel(self):
        header = {"Authorization": f"Token {self._jupyter_server_token}"}
        return create_connection(
            f"{self.get_protocol('ws')}://{self.get_hostname(8888)}/api/kernels/{self._jupyter_kernel_id}/channels",
            header=header,
        )

    @staticmethod
    def _send_execute_request(code: str) -> dict:
        msg_id = str(uuid.uuid4())
        session = str(uuid.uuid4())

        return {
            "header": {
                "msg_id": msg_id,
                "username": "e2b",
                "session": session,
                "msg_type": "execute_request",
                "version": "5.3",
            },
            "parent_header": {},
            "metadata": {},
            "content": {
                "code": code,
                "silent": False,
                "store_history": False,
                "user_expressions": {},
                "allow_stdin": False,
            },
        }

    @staticmethod
    def _wait_for_result(
        ws,
        on_stdout: Optional[Callable[[ProcessMessage], Any]],
        on_stderr: Optional[Callable[[ProcessMessage], Any]],
    ) -> Result:
        result = Result()
        input_accepted = False

        while True:
            response = json.loads(ws.recv())
            if response["msg_type"] == "error":
                result.error = Error(
                    name=response["content"]["ename"],
                    value=response["content"]["evalue"],
                    traceback=response["content"]["traceback"],
                )

            elif response["msg_type"] == "stream":
                if response["content"]["name"] == "stdout":
                    result.stdout.append(response["content"]["text"])
                    if on_stdout:
                        on_stdout(
                            ProcessMessage(
                                line=response["content"]["text"],
                                timestamp=time.time_ns(),
                            )
                        )

                elif response["content"]["name"] == "stderr":
                    result.stderr.append(response["content"]["text"])
                    if on_stderr:
                        on_stderr(
                            ProcessMessage(
                                line=response["content"]["text"],
                                error=True,
                                timestamp=time.time_ns(),
                            )
                        )

            elif response["msg_type"] == "display_data":
                result.display_data.append(response["content"]["data"])

            elif response["msg_type"] == "execute_result":
                result.output = response["content"]["data"]["text/plain"]

            elif response["msg_type"] == "status":
                if response["content"]["execution_state"] == "idle":
                    if input_accepted:
                        break
                elif response["content"]["execution_state"] == "error":
                    result.error = Error(
                        name=response["content"]["ename"],
                        value=response["content"]["evalue"],
                        traceback=response["content"]["traceback"],
                    )
                    break

            elif response["msg_type"] == "execute_reply":
                if response["content"]["status"] == "error":
                    result.error = Error(
                        name=response["content"]["ename"],
                        value=response["content"]["evalue"],
                        traceback=response["content"]["traceback"],
                    )
                elif response["content"]["status"] == "ok":
                    pass

            elif response["msg_type"] == "execute_input":
                input_accepted = True
            else:
                print("[UNHANDLED MESSAGE TYPE]:", response["msg_type"])
        return result

    def exec_python(
        self,
        code: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
    ) -> Result:
        ws = self._connect_kernel()
        ws.send(json.dumps(self._send_execute_request(code)))
        result = self._wait_for_result(ws, on_stdout, on_stderr)

        ws.close()

        return result
