import logging
import httpx

from typing import cast, Optional, Dict, overload, Union, List
from httpx import Client
from e2b import Sandbox as BaseSandbox, InvalidArgumentException
from e2b.api.client_sync import get_transport

from e2b_code_interpreter.constants import (
    DEFAULT_TEMPLATE,
    JUPYTER_PORT,
    DEFAULT_TIMEOUT,
)
from e2b_code_interpreter.models import (
    ExecutionError,
    Execution,
    RunCodeLanguage,
    Context,
    Result,
    extract_exception,
    parse_output,
    OutputHandler,
    OutputMessage,
)
from e2b_code_interpreter.exceptions import (
    format_execution_timeout_error,
    format_request_timeout_error,
    format_sandbox_killed_error,
)

logger = logging.getLogger(__name__)


class Sandbox(BaseSandbox):
    """
    E2B cloud sandbox is a secure and isolated cloud environment.

    The sandbox allows you to:
    - Access Linux OS
    - Create, list, and delete files and directories
    - Run commands
    - Run isolated code
    - Access the internet

    Check docs [here](https://e2b.dev/docs).

    Use the `Sandbox.create()` to create a new sandbox.

    Example:
    ```python
    from e2b_code_interpreter import Sandbox

    sandbox = Sandbox.create()
    ```
    """

    default_template = DEFAULT_TEMPLATE

    @property
    def _jupyter_url(self) -> str:
        # Honors the `sandbox_url` option and the `E2B_SANDBOX_URL` environment
        # variable, same as the base SDK does for envd requests.
        sandbox_url = cast(Optional[str], self.connection_config._sandbox_url)
        if sandbox_url:
            return sandbox_url
        return f"{'http' if self.connection_config.debug else 'https'}://{self.get_host(JUPYTER_PORT)}"

    def _jupyter_request_url(self, path: str) -> str:
        url = f"{self._jupyter_url}{path}"
        source = getattr(self.connection_config, "request_source", None)
        if not source:
            return url
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}source={source}"

    @property
    def _client(self) -> Client:
        # TODO: Remove later
        # Use a dedicated HTTP/1.1 transport for Jupyter requests.
        #
        # The base SDK's shared transport now defaults to http2=True. With
        # HTTP/2, multiple requests are multiplexed over a single TCP
        # connection, so when a client cancels a request (e.g. the caller
        # disconnects from the streaming `/execute` endpoint) the server
        # may not detect the disconnect: only the HTTP/2 stream is
        # cancelled, the underlying TCP connection stays open.
        #
        # Forcing HTTP/1.1 here keeps the 1:1 mapping between TCP
        # connection and request, so client disconnects propagate to the
        # server as a TCP close and long-running executions can be
        # cancelled reliably.
        return Client(transport=get_transport(self.connection_config, http2=False))

    def _handle_connection_error(self, err: Exception) -> None:
        """
        Raises a descriptive exception if the connection error was caused by
        the sandbox being killed mid-request. If the sandbox is still running
        (or its state can't be determined), returns so the caller can re-raise
        the original error.
        """
        try:
            running = self.is_running()
        except Exception:
            # The state check itself failed, so we can't tell whether the
            # sandbox was killed — let the caller re-raise the original error
            # instead of wrongly claiming the sandbox is gone.
            return
        if not running:
            raise format_sandbox_killed_error() from err

    @overload
    def run_code(
        self,
        code: str,
        language: Optional[RunCodeLanguage] = None,
        on_stdout: Optional[OutputHandler[OutputMessage]] = None,
        on_stderr: Optional[OutputHandler[OutputMessage]] = None,
        on_result: Optional[OutputHandler[Result]] = None,
        on_error: Optional[OutputHandler[ExecutionError]] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> Execution:
        """
        Runs the code for the specified language.

        Specify the `language` or `context` option to run the code as a different language or in a different `Context`.
        If no language is specified, Python is used.

        You can reference previously defined variables, imports, and functions in the code.

        :param code: Code to execute
        :param language: Language to use for code execution. If not defined, the default Python context is used.
        :param on_stdout: Callback for stdout messages
        :param on_stderr: Callback for stderr messages
        :param on_result: Callback for the `Result` object
        :param on_error: Callback for the `ExecutionError` object
        :param envs: Custom environment variables
        :param timeout: Timeout for the code execution in **seconds**
        :param request_timeout: Timeout for the request in **seconds**

        :return: `Execution` result object
        """
        ...

    @overload
    def run_code(
        self,
        code: str,
        context: Optional[Context] = None,
        on_stdout: Optional[OutputHandler[OutputMessage]] = None,
        on_stderr: Optional[OutputHandler[OutputMessage]] = None,
        on_result: Optional[OutputHandler[Result]] = None,
        on_error: Optional[OutputHandler[ExecutionError]] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> Execution:
        """
        Runs the code in the specified context, if not specified, the default context is used.

        Specify the `language` or `context` option to run the code as a different language or in a different `Context`.

        You can reference previously defined variables, imports, and functions in the code.

        :param code: Code to execute
        :param context: Concrete context to run the code in. If not specified, the default context for the language is used. It's mutually exclusive with the language.
        :param on_stdout: Callback for stdout messages
        :param on_stderr: Callback for stderr messages
        :param on_result: Callback for the `Result` object
        :param on_error: Callback for the `ExecutionError` object
        :param envs: Custom environment variables
        :param timeout: Timeout for the code execution in **seconds**
        :param request_timeout: Timeout for the request in **seconds**

        :return: `Execution` result object
        """
        ...

    def run_code(
        self,
        code: str,
        language: Optional[str] = None,
        context: Optional[Context] = None,
        on_stdout: Optional[OutputHandler[OutputMessage]] = None,
        on_stderr: Optional[OutputHandler[OutputMessage]] = None,
        on_result: Optional[OutputHandler[Result]] = None,
        on_error: Optional[OutputHandler[ExecutionError]] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> Execution:
        logger.debug(f"Executing code {code}")

        if language and context:
            raise InvalidArgumentException(
                "You can provide context or language, but not both at the same time."
            )

        timeout = None if timeout == 0 else (timeout or DEFAULT_TIMEOUT)
        request_timeout = request_timeout or self.connection_config.request_timeout
        context_id = context.id if context else None

        try:
            headers: Dict[str, str] = {
                "Content-Type": "application/json",
                "E2b-Sandbox-Id": self.sandbox_id,
                "E2b-Sandbox-Port": str(JUPYTER_PORT),
            }
            if self._envd_access_token:
                headers["X-Access-Token"] = self._envd_access_token
            if self.traffic_access_token:
                headers["E2B-Traffic-Access-Token"] = self.traffic_access_token

            with self._client.stream(
                "POST",
                self._jupyter_request_url("/execute"),
                json={
                    "code": code,
                    "context_id": context_id,
                    "language": language,
                    "env_vars": envs,
                },
                headers=headers,
                # `timeout` bounds the execution, `request_timeout` only the
                # connect. Every non-connect phase must carry `timeout`: the
                # SDK's pyqwest-backed transport collapses the per-phase
                # timeouts into a single whole-request deadline and takes the
                # longest of them, so leaving `request_timeout` on the write
                # and pool phases would raise the floor to
                # `max(timeout, request_timeout)` and silently ignore any
                # `timeout` shorter than it. This matches the JS SDK, which
                # aborts the execution on a `timeout`-long timer.
                # `timeout=0` disables the deadline entirely; the transport
                # still bounds connect on its own.
                timeout=(
                    httpx.Timeout(timeout, connect=request_timeout)
                    if timeout is not None
                    else httpx.Timeout(None)
                ),
            ) as response:
                err = extract_exception(response)
                if err:
                    raise err

                execution = Execution()

                for line in response.iter_lines():
                    parse_output(
                        execution,
                        line,
                        on_stdout=on_stdout,
                        on_stderr=on_stderr,
                        on_result=on_result,
                        on_error=on_error,
                    )

                return execution
        except httpx.ReadTimeout:
            raise format_execution_timeout_error()
        except httpx.TimeoutException:
            raise format_request_timeout_error()
        except (httpx.ReadError, httpx.RemoteProtocolError) as err:
            self._handle_connection_error(err)
            raise

    def create_code_context(
        self,
        cwd: Optional[str] = None,
        language: Optional[RunCodeLanguage] = None,
        request_timeout: Optional[float] = None,
    ) -> Context:
        """
        Creates a new context to run code in.

        :param cwd: Set the current working directory for the context, defaults to `/home/user`
        :param language: Language of the context. If not specified, defaults to Python
        :param request_timeout: Timeout for the request in **milliseconds**

        :return: Context object
        """
        logger.debug(f"Creating new {language} context")

        data = {}
        if language:
            data["language"] = language
        if cwd:
            data["cwd"] = cwd

        try:
            headers: Dict[str, str] = {
                "Content-Type": "application/json",
                "E2b-Sandbox-Id": self.sandbox_id,
                "E2b-Sandbox-Port": str(JUPYTER_PORT),
            }
            if self.traffic_access_token:
                headers["E2B-Traffic-Access-Token"] = self.traffic_access_token

            response = self._client.post(
                self._jupyter_request_url("/contexts"),
                json=data,
                headers=headers,
                timeout=request_timeout or self.connection_config.request_timeout,
            )

            err = extract_exception(response)
            if err:
                raise err

            data = response.json()
            return Context.from_json(data)
        except httpx.TimeoutException:
            raise format_request_timeout_error()
        except (httpx.ReadError, httpx.RemoteProtocolError) as err:
            self._handle_connection_error(err)
            raise

    def remove_code_context(
        self,
        context: Union[Context, str],
    ) -> None:
        """
        Removes a context.

        :param context: Context to remove. Can be a Context object or a context ID string.

        :return: None
        """
        context_id = context.id if isinstance(context, Context) else context

        try:
            headers: Dict[str, str] = {
                "Content-Type": "application/json",
                "E2b-Sandbox-Id": self.sandbox_id,
                "E2b-Sandbox-Port": str(JUPYTER_PORT),
            }
            if self.traffic_access_token:
                headers["E2B-Traffic-Access-Token"] = self.traffic_access_token

            response = self._client.delete(
                self._jupyter_request_url(f"/contexts/{context_id}"),
                headers=headers,
                timeout=self.connection_config.request_timeout,
            )

            err = extract_exception(response)
            if err:
                raise err
        except httpx.TimeoutException:
            raise format_request_timeout_error()
        except (httpx.ReadError, httpx.RemoteProtocolError) as err:
            self._handle_connection_error(err)
            raise

    def list_code_contexts(self) -> List[Context]:
        """
        List all contexts.

        :return: List of contexts.
        """
        try:
            headers: Dict[str, str] = {
                "Content-Type": "application/json",
                "E2b-Sandbox-Id": self.sandbox_id,
                "E2b-Sandbox-Port": str(JUPYTER_PORT),
            }
            if self.traffic_access_token:
                headers["E2B-Traffic-Access-Token"] = self.traffic_access_token

            response = self._client.get(
                self._jupyter_request_url("/contexts"),
                headers=headers,
                timeout=self.connection_config.request_timeout,
            )

            err = extract_exception(response)
            if err:
                raise err

            data = response.json()
            return [Context.from_json(context_data) for context_data in data]
        except httpx.TimeoutException:
            raise format_request_timeout_error()
        except (httpx.ReadError, httpx.RemoteProtocolError) as err:
            self._handle_connection_error(err)
            raise

    def restart_code_context(
        self,
        context: Union[Context, str],
    ) -> None:
        """
        Restart a context.

        :param context: Context to restart. Can be a Context object or a context ID string.

        :return: None
        """
        context_id = context.id if isinstance(context, Context) else context

        try:
            headers: Dict[str, str] = {
                "Content-Type": "application/json",
                "E2b-Sandbox-Id": self.sandbox_id,
                "E2b-Sandbox-Port": str(JUPYTER_PORT),
            }
            if self.traffic_access_token:
                headers["E2B-Traffic-Access-Token"] = self.traffic_access_token

            response = self._client.post(
                self._jupyter_request_url(f"/contexts/{context_id}/restart"),
                headers=headers,
                timeout=self.connection_config.request_timeout,
            )

            err = extract_exception(response)
            if err:
                raise err
        except httpx.TimeoutException:
            raise format_request_timeout_error()
        except (httpx.ReadError, httpx.RemoteProtocolError) as err:
            self._handle_connection_error(err)
            raise
