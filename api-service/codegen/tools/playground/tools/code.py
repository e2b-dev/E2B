from langchain.agents import tool

from codegen.tools.playground.playground import NodeJSPlayground
from codegen.tools.playground.tools.process import encode_command_output


def create_code_tools(playground: NodeJSPlayground):
    @tool("InstallDependencies")
    def install_dependencies(dependencies: str) -> str:
        """Install specified dependecies with NPM and return errors."""
        output = playground.install_dependencies(dependencies)
        return encode_command_output(output, only_errors=True)

    yield install_dependencies

    # TODO: Escape code
    @tool("RunTypeScriptCode")
    def run_typescript_code(code: str) -> str:
        """Run the specified TypeScript code and return errors and output."""
        output = playground.run_typescript_code(code)
        return encode_command_output(output)

    yield run_typescript_code

    # TODO: Escape code
    @tool("CheckTypeScriptTypes")
    def check_typescript_types(code: str) -> str:
        """Check TypeScript types in the specified code and return errors."""
        output = playground.check_typescript_code(code)
        return encode_command_output(output)

    yield check_typescript_types

    # TODO: Escape code
    @tool("RunJavaScriptCode")
    def run_javascript_code(code: str) -> str:
        """Run the specified JavaScript code and return errors and output."""
        output = playground.run_javascript_code(code)
        return encode_command_output(output)

    yield run_javascript_code
