from langchain.agents import tool

from codegen.tools.playground.playground import NodeJSPlayground, CommandOutput


def encode_command_output(output: CommandOutput, only_errors: bool = False) -> str:
    if only_errors:
        if output.error is not None:
            return f"Errors: {output.error}"
        return ""
    errors = f"Errors: {output.error}\n" if output.error is not None else ""
    return errors + f"Output: {output.output}"


def create_process_tools(playground: NodeJSPlayground):
    # TODO: Escape command
    @tool("RunCommand")
    def run_command(command: str) -> str:
        """Run specified command in the terminal and return output and errors."""
        output = playground.run_command(command)
        return encode_command_output(output)

    yield run_command
