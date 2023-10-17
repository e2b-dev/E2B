import logging
import urllib.parse
import requests

from os import path
from typing import Any, Callable, List, Literal, Optional, Union, IO

from e2b.constants import TIMEOUT, ENVD_PORT, FILE_ROUTE
from e2b.session.code_snippet import CodeSnippetManager, OpenPort
from e2b.session.env_vars import EnvVars
from e2b.session.filesystem import FilesystemManager
from e2b.session.process import ProcessManager
from e2b.session.session_connection import SessionConnection
from e2b.session.terminal import TerminalManager

logger = logging.getLogger(__name__)

Environment = Literal[
    "Nodejs",
    "Bash",
    "Python3",
    "Java",
    "Go",
    "Rust",
    "PHP",
    "Perl",
    "DotNET",
]


class Session(SessionConnection):
    """
    E2B cloud environment gives your agent a full cloud development environment that's sandboxed. That means:

    - Access to Linux OS
    - Using filesystem (create, list, and delete files and dirs)
    - Run processes
    - Sandboxed - you can run any code
    - Access to the internet

    These cloud environments are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.
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
        id: Union[Environment, str],
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
        on_stdout: Optional[Callable[[str], Any]] = None,
        on_stderr: Optional[Callable[[str], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        timeout: Optional[float] = TIMEOUT,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        """
        Creates a new cloud environment session.

        :param id: ID of the environment or the environment type template.
        Can be one of the following environment type templates or a custom environment ID:
        - `Nodejs`
        - `Bash`
        - `Python3`
        - `Java`
        - `Go`
        - `Rust`
        - `PHP`
        - `Perl`
        - `DotNET`

        :param api_key: The API key to use, if not provided, the `E2B_API_KEY` environment variable is used
        :param cwd: The current working directory to use
        :param on_scan_ports: A callback to handle opened ports
        :param on_stdout: A default callback that is called when stdout with a newline is received from the process
        :param on_stderr: A default callback that is called when stderr with a newline is received from the process
        :param on_exit: A default callback that is called when the process exits
        """

        logger.info(f"Creating session {id if isinstance(id, str) else type(id)}")
        if cwd and cwd.startswith("~"):
            cwd = cwd.replace("~", "/home/user")

        self._code_snippet = CodeSnippetManager(
            session=self,
            on_scan_ports=on_scan_ports,
        )
        self._terminal = TerminalManager(session=self)
        self._filesystem = FilesystemManager(session=self)
        self._process = ProcessManager(
            session=self, on_stdout=on_stdout, on_stderr=on_stderr, on_exit=on_exit
        )
        super().__init__(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
            on_close=self._close_services,
            timeout=timeout,
        )

    def _open(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Opens the session.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        logger.info(f"Opening session {self._id}")
        super()._open(timeout=timeout)
        self._code_snippet._subscribe()
        logger.info(f"Session {self._id} opened")
        if self.cwd:
            self.filesystem.make_dir(self.cwd)

    def _close_services(self):
        self._terminal._close()
        self._process._close()

    def close(self) -> None:
        """
        Closes the session.
        """
        super().close()
        self._close()

    def file_url(self) -> str:
        """
        Returns a URL that can be used to upload files to the session via a multipart/form-data POST request.
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
        Uploads a file to the session.
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
        Downloads a file from the session and returns it's content as bytes.

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
