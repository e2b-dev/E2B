from langchain.agents import tool

from codegen.tools.playground.mock.request import MockRequestFactory
from codegen.tools.playground.playground import NodeJSPlayground
from codegen.tools.playground.tools.process import encode_command_output


def extract_code(code: str):
    return code.strip().strip("`").strip()


def create_code_tools(playground: NodeJSPlayground, mock: MockRequestFactory):
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @tool("InstallNPMDependencies")
    def install_dependencies(dependencies: str) -> str:
        """
        Install specified dependecies with NPM and return errors.
        The input should be a list of Node.js dependencies separated by spaces.
        """
        output = playground.install_dependencies(extract_code(dependencies))
        result = encode_command_output(output, only_errors=True)
        return result if len(result) > 0 else "All dependencies installed"

    yield install_dependencies

    # This tool is just for executing TypeScript without doing the request to server
    # @tool("RunTypeScriptCode")
    # def run_typescript_code(code: str) -> str:
    #     """
    #     Run the specified TypeScript code and return errors and output.
    #     The input should be a valid TypeScript code.
    #     The returned result will be the output and errors returned when executing the code.
    #     """
    #     output = playground.run_typescript_code(extract_code(code))
    #     result = encode_command_output(output)

    #     return result if len(result) > 0 else "Code execution finished without error"

    # # yield run_typescript_code

    @tool("RunTypeScriptCode")
    def run_typescript_code(code: str) -> str:
        """
        Execute TypeScript code and make a request to see if server correctly handles needed requests.
        The input should be a valid TypeScript code.
        The server should run on http://localhost:3000.
        The returned result is a the request's output followed by the server code output and errors.
        """
        mock_request_cmd = mock.terminal_command()

        port = 3000
        request_output, server_output = playground.run_typescript_server_code_with_request(
            code=code, request_cmd=mock_request_cmd, port=port,
        )

        request_result = encode_command_output(request_output)
        server_result = encode_command_output(server_output)

        return f"Request result:\n{request_result}\nCode execution result:\n{server_result}"


    # yield run_typescript_code

    @tool("CheckTypeScriptCodeTypes")
    def check_typescript_code_types(code: str) -> str:
        """
        Check TypeScript types in the specified code and return errors.
        """
        output = playground.check_typescript_code(extract_code(code))
        result = encode_command_output(output, only_errors=True)

        return result if len(result) > 0 else "Typechecking finished without error"

    # yield check_typescript_code_types

    # This tool is just for executing JavaScript without doing the request to server
    # @tool("RunJavaScriptCode")
    # def run_javascript_code(code: str) -> str:
    #     """
    #     Run JavaScript code and return errors and output.
    #     Input should be a valid JavaScript code.
    #     """
    #     output = playground.run_javascript_code(extract_code(code))
    #     result = encode_command_output(output)
    #     return result if len(result) > 0 else "Code execution finished without error"

    # yield run_javascript_code

    @tool("RunJavaScriptCode")
    def run_javascript_code(code: str) -> str:
        """
        Execute JavaScript code and make a request to see if server correctly handles needed requests.
        The input should be a valid JavaScript code.
        The server should run on http://localhost:3000.
        The returned result is a the request's output followed by the server code output and errors.
        """

        mock_request_cmd = mock.terminal_command()

        port = 3000
        request_output, server_output = playground.run_javascript_server_code_with_request(
            code=code, request_cmd=mock_request_cmd, port=port,
        )

        request_result = encode_command_output(request_output)
        server_result = encode_command_output(server_output)

        return f"Request result:\n{request_result}\nCode execution result:\n{server_result}"

    yield run_javascript_code
