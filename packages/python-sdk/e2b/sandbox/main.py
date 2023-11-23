import logging
import urllib.parse
import requests

from os import path
from typing import Any, Callable, Dict, List, Literal, Optional, IO, Tuple, Union

from e2b.api import models
from e2b.constants import TIMEOUT, ENVD_PORT, FILE_ROUTE
from e2b.sandbox.code_snippet import CodeSnippetManager, OpenPort
from e2b.sandbox.env_vars import EnvVars
from e2b.sandbox.filesystem import FilesystemManager
from e2b.sandbox.process import ProcessManager, ProcessMessage
from e2b.sandbox.sandbox_connection import SandboxConnection
from e2b.sandbox.terminal import TerminalManager

logger = logging.getLogger(__name__)


class Sandbox(SandboxConnection):
    """
    E2B cloud sandbox gives your agent a full cloud development environment that's sandboxed.

    That means:
    - Access to Linux OS
    - Using filesystem (create, list, and delete files and dirs)
    - Run processes
    - Sandboxed - you can run any code
    - Access to the internet

    Check usage docs - https://e2b.dev/docs/sandbox/overview

    These cloud sandboxes are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.
    """

    @property
    def process(self) -> ProcessManager:
        """
        Process manager used to run commands.
        """
        return self._process

    @property
    def terminal(self) -> TerminalManager:
        """
        Terminal manager used to create interactive terminals.
        """
        return self._terminal

    @property
    def filesystem(self) -> FilesystemManager:
        """
        Filesystem manager used to manage files.
        """
        return self._filesystem

    def __init__(
        self,
        id: str = "base",
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        timeout: Optional[float] = TIMEOUT,
        _sandbox: Optional[models.Instance] = None,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        """
        Create a new cloud sandbox.

        :param id: ID of the sandbox template or the name of prepared template.
        Can be one of the following premade sandbox templates or a custom sandbox template ID:
        - `base` - A basic sandbox with a Linux environment
        - `Python3-DataAnalysis` - A Python3 sandbox with data analysis tools

        :param api_key: The API key to use, if not provided, the `E2B_API_KEY` environment variable is used
        :param cwd: The current working directory to use
        :param on_scan_ports: A callback to handle opened ports
        :param on_stdout: A default callback that is called when stdout with a newline is received from the process
        :param on_stderr: A default callback that is called when stderr with a newline is received from the process
        :param on_exit: A default callback that is called when the process exits
        :param timeout: Timeout for sandbox to initialize in seconds, default is 60 seconds
        """

        logger.info(f"Creating sandbox {id if isinstance(id, str) else type(id)}")
        if cwd and cwd.startswith("~"):
            cwd = cwd.replace("~", "/home/user")

        self._code_snippet = CodeSnippetManager(
            sandbox=self,
            on_scan_ports=on_scan_ports,
        )
        self._terminal = TerminalManager(sandbox=self)
        self._filesystem = FilesystemManager(sandbox=self)
        self._process = ProcessManager(
            sandbox=self,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
        )
        super().__init__(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            _sandbox=_sandbox,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
            timeout=timeout,
        )
        self._on_close_child = self._close_services
        self._actions: Dict[str, Action] = {}

    def add_action(self, action: "Action", name: Optional[str] = None) -> "Sandbox":
        """
        Add a new action. If the name is not specified, it is automatically extracted from the function name.
        An action is a function that takes a sandbox and a dictionary of arguments and returns a string.

        You can use this action with specific integrations like OpenAI to interact with the sandbox and get output for the action.
        :param action: The action to add
        :param name: The name of the action, if not provided, the name of the function will be used

        Example:

            ```python
            from e2b import Sandbox

            def read_file(sandbox, args):
                with open(args["path"], "r") as f:
                    return sandbox.filesystem.read(args.path)

            s = Sandbox()
            s.add_action(read_file)
            s.add_action(name="hello", action=lambda s, args: f"Hello {args['name']}!")
            ```
        """
        if not name:
            name = action.__name__

        self._actions[name] = action

        return self

    def remove_action(self, name: str) -> "Sandbox":
        """
        Remove an action.

        :param name: The name of the action
        """
        del self._actions[name]

        return self

    @property
    def actions(self) -> Dict[str, "Action"]:
        """
        Return a dict of added actions.
        """

        return self._actions.copy()

    def action(self, name: Optional[str] = None):
        """
        Decorator to add an action.

        :param name: The name of the action, if not provided, the name of the function will be used
        """

        def _action(action: Action):
            self.add_action(action=action, name=name or action.__name__)

            return action

        return _action

    @property
    def openai(self):
        """
        OpenAI integration that can be used to get output for the actions added in the sandbox.

        Example:

            ```python
            from e2b import Sandbox

            s = Sandbox()
            s.openai.actions.run(run)
            ```
        """

        from e2b.templates.openai import OpenAI, Actions

        return OpenAI(Actions(self))

    def _open(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Open the sandbox.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.info(f"Opening sandbox {self._id}")
        super()._open(timeout=timeout)
        self._code_snippet._subscribe()
        logger.info(f"Sandbox {self._id} opened")
        if self.cwd:
            self.filesystem.make_dir(self.cwd)

    def _close_services(self):
        self._terminal._close()
        self._process._close()

    def close(self) -> None:
        """
        Close the sandbox.
        """
        super().close()
        self._close()

    def file_url(self) -> str:
        """
        Return a URL that can be used to upload files to the sandbox via a multipart/form-data POST request.
        This is useful if you're uploading files directly from the browser.
        The file will be uploaded to the user's home directory with the same name.
        If a file with the same name already exists, it will be overwritten.
        """
        hostname = self.get_hostname(self._debug_port or ENVD_PORT)
        protocol = "http" if self._debug_dev_env == "local" else "https"

        file_url = f"{protocol}://{hostname}{FILE_ROUTE}"

        return file_url

    def upload_file(self, file: IO, timeout: Optional[float] = TIMEOUT) -> str:
        """
        Upload a file to the sandbox.
        The file will be uploaded to the user's home (`/home/user`) directory with the same name.
        If a file with the same name already exists, it will be overwritten.

        :param file: The file to upload
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        files = {"file": file}
        r = requests.post(self.file_url(), files=files, timeout=timeout)
        if r.status_code != 200:
            raise Exception(f"Failed to upload file: {r.reason} {r.text}")

        filename = path.basename(file.name)
        return f"/home/user/{filename}"

    def download_file(
        self, remote_path: str, timeout: Optional[float] = TIMEOUT
    ) -> bytes:
        """
        Download a file from the sandbox and returns it's content as bytes.

        :param remote_path: The path of the file to download
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        encoded_path = urllib.parse.quote(remote_path)
        url = f"{self.file_url()}?path={encoded_path}"
        r = requests.get(url, timeout=timeout)

        if r.status_code != 200:
            raise Exception(
                f"Failed to download file '{remote_path}'. {r.reason} {r.text}"
            )
        return r.content

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()


Action = Callable[[Sandbox, Dict[str, Any]], str]
