from langchain.agents import tool

from codegen.tools.playground.playground import NodeJSPlayground
from playground_client.models.run_process_response import RunProcessResponse


def encode_command_output(response: RunProcessResponse, only_errors: bool = False) -> str:
    result = ""

    err_lines = [err.line for err in response.stderr]
    errors = "\n".join(err_lines)

    if len(errors) > 0:
        result += f"Errors: {errors}"

    if only_errors:
        return result

    out_lines = [out.line for out in response.stdout]
    output = "\n".join(out_lines)

    if len(output) > 0:
        result += f"Output: {output}"

    return result


def create_process_tools(playground: NodeJSPlayground):
    # TODO: Escape command
    @tool("RunTerminalCommand")
    def run_terminal_command(command: str) -> str:
        """
        Run specified command in the terminal and return output and errors.
        The input should be a a valid terminal command.
        The environment where the command runs is Alpine Linux.
        It has access to the internet and to basic utility tools like `curl`.
        The returned result will be the output and errors returned when running the command.
        """
        output = playground.run_command(command)
        return encode_command_output(output)

    yield run_terminal_command
