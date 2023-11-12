import json

from typing import Callable, Dict, Any, List, Literal, Optional, TYPE_CHECKING

from e2b.constants import TIMEOUT
from e2b.sandbox.code_snippet import OpenPort
from e2b.sandbox.env_vars import EnvVars
from e2b.sandbox.main import Sandbox
from e2b.sandbox.process import ProcessMessage

if TYPE_CHECKING:
    from openai.types.beta.threads.run_submit_tool_outputs_params import ToolOutput
    from openai.types.beta.threads.run import Run


Action = Callable[[Sandbox, Dict[str, Any]], str]


class Assistant:
    def __init__(self, sandbox: "ActionSandbox"):
        self._sandbox = sandbox

    def run(self, run: "Run"):
        return self._sandbox._run(run)


class OpenAI:
    def __init__(self, assistant: Assistant):
        self._assistant = assistant

    @property
    def assistant(self):
        return self._assistant


class ActionSandbox(Sandbox):
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
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        super().__init__(
            id=id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            on_scan_ports=on_scan_ports,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            timeout=timeout,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )
        self._actions: Dict[str, Action] = {}

    def _run(self, run: "Run") -> List["ToolOutput"]:
        if run.status != "requires_action":
            return []

        if not run.required_action:
            return []

        outputs = []

        for tool_call in run.required_action.submit_tool_outputs.tool_calls:
            action = self._actions.get(tool_call.function.name)
            if not action:
                continue

            args = json.loads(tool_call.function.arguments)
            output = action(self, args)

            outputs.append(
                {
                    "tool_call_id": tool_call.id,
                    "output": output,
                }
            )

        return outputs

    def register_action(self, name: str, action: Action):
        self._actions[name] = action

        return self

    @property
    def openai(self) -> OpenAI:
        return OpenAI(Assistant(self))
