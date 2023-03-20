from langchain.agents import tool

from session.playground import NodeJSPlayground
from playground_client.models.process_response import ProcessResponse


def encode_command_output(response: ProcessResponse, only_errors: bool = False) -> str:
    result = ""

    err_lines = [err.line for err in response.stderr if "Error:" in err.line]
    # err_lines = [err.line for err in response.stderr]

    errors = "\n".join(err_lines)

    if len(errors) > 0:
        result += f"Errors:\n{errors}\n"

    if only_errors:
        return result

    print(errors)
    out_lines = [out.line for out in response.stdout]
    output = "\n".join(out_lines)

    if len(output) > 0:
        result += f"Output:\n{output}"

    return result


def create_process_tools(playground: NodeJSPlayground, **kwargs):
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    # TODO: Escape command?
    @tool("RunTerminalCommand")
    def run_terminal_command(command: str) -> str:
        """
        Run specified command in the terminal and return output and errors.
        The input should be a a valid terminal command.
        The returned result will be the output and errors returned when running the command.
        """
        output = playground.run_command(command)
        result = encode_command_output(output)

        return result if len(result) > 0 else "Process finished without error"

    yield run_terminal_command
