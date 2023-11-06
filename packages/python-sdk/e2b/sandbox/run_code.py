from os import getenv
from typing import Literal, Union, Optional

from . import Sandbox
from .exception import UnsupportedRuntimeException

CodeRuntime = Literal[
    "Node16",
    "Python3",
    "Bash",
    "Python3-DataAnalysis",
]


def run_code(
    runtime: Union[CodeRuntime, str],
    code: str,
    api_key: Optional[str] = None,
):
    """
    Run code in a sandboxed cloud playground and return the stdout and stderr.

    `run_code` wraps the `Sandbox` class and provides a simple interface for running code in a sandbox
    without any need to manage lifecycle of the sandbox.
    `run_code` automatically loads the E2B API key from the `E2B_API_KEY` environment variable.

    :param runtime: The runtime to run the code in. One of "Node16" or "Python3".
    :param code: The code to run
    :param api_key: The E2B API key to use. If not provided, the `E2B_API_KEY` environment variable is used.

    :return: A string touple of stdout and stderr
    """

    if api_key is None:
        api_key = getenv("E2B_API_KEY")

    if runtime == "Node16":
        env_id = "base"
        binary = "node"
        filepath = "/index.js"
    elif runtime == "Python3":
        env_id = "base"
        binary = "python3"
        filepath = "/index.py"
    elif runtime == "Python3-DataAnalysis":
        env_id = "Python3-DataAnalysis"
        binary = "python3"
        filepath = "/index.py"
    elif runtime == "Bash":
        env_id = "base"
        binary = "bash"
        filepath = "/main.sh"
    else:
        raise UnsupportedRuntimeException(
            f'Invalid runtime "{runtime}". Please contact us (hello@e2b.dev) if you need support for this runtime'
        )

    sandbox = Sandbox(id=env_id, api_key=api_key)
    sandbox.filesystem.write(filepath, code)

    proc = sandbox.process.start(cmd=f"{binary} {filepath}")
    proc.wait()

    sandbox.close()

    return proc.output.stdout, proc.output.stderr
