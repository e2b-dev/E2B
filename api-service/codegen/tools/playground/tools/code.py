from langchain.agents import tool

from codegen.tools.playground.playground import NodeJSPlayground
from codegen.tools.playground.tools.process import encode_command_output


def extract_code(code: str):
    return code.strip().strip("`").strip()

def create_code_tools(playground: NodeJSPlayground):
    # Ensure that the function is a generator even if no tools are yielded
    yield from []

    @tool("InstallNPMDependencies")
    def install_dependencies(dependencies: str) -> str:
        """
        Install specified dependecies with NPM and return errors.
        The input should be a list of Node.js dependencies separated by spaces.
        If you are using this tool to handle missing dependency error try to run the code again after the installation.
        """
        output = playground.install_dependencies(extract_code(dependencies))
        result = encode_command_output(output, only_errors=True)
        return result if len(result) > 0 else "All dependencies installed"

    yield install_dependencies

    @tool("RunTypeScriptCode")
    def run_typescript_code(code: str) -> str:
        """
        Run the specified TypeScript code and return errors and output.
        The input should be a valid TypeScript code.
        The returned result will be the output and errors returned when executing the code.
        """
        output = playground.run_typescript_code(extract_code(code))
        result = encode_command_output(output)

        return result if len(result) > 0 else "Code execution finished without error"

    yield run_typescript_code

    @tool("CheckTypeScriptCodeTypes")
    def check_typescript_code_types(code: str) -> str:
        """
        Check TypeScript types in the specified code and return errors.
        """
        output = playground.check_typescript_code(extract_code(code))
        result = encode_command_output(output, only_errors=True)

        return result if len(result) > 0 else "Typechecking finished without error"

    yield check_typescript_code_types

    @tool("RunJavaScriptCode")
    def run_javascript_code(code: str) -> str:
        """
        Run the specified JavaScript code and return errors and output.
        """
        output = playground.run_javascript_code(extract_code(code))
        result = encode_command_output(output)
        return result if len(result) > 0 else "Code execution finished without error"

    yield run_javascript_code

    # @tool("JavaScriptREPL/Shell")
    # @tool("ServerRequestTest")
    # @tool("ServerRequestTest")
