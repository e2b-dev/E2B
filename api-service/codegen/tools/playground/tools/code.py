from langchain.agents import tool

from codegen.tools.playground.mock.request import MockRequestFactory
from session.playground import NodeJSPlayground
from codegen.tools.playground.tools.process import encode_command_output


def extract_code(code: str):
    return code.strip().strip("`").strip()


def create_code_tools(playground: NodeJSPlayground, mock: MockRequestFactory):
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @tool("InstallNPMDependencies")
    def install_dependencies(dependencies: str) -> str:
        """Install JavaScript packages with NPM. The input should be valid names of NPM packages. Example usage:
        ```
        <action tool="InstallNPMDependencies">
        package_name_1 package_name_2
        </action>
        ```"""
        output = playground.install_dependencies(extract_code(dependencies))
        result = encode_command_output(output, only_errors=True)
        return result if len(result) > 0 else "All dependencies installed"

    yield install_dependencies

    last_javascript_code: str | None = None

    # This tool is just for executing JavaScript without doing the request to server
    @tool("RunJavaScriptCode")
    def run_javascript_code(code: str) -> str:
        """
        Run JavaScript code and return output.
        Input should be a valid JavaScript code.
        """

        with_require = f"""
        import {{ createRequire }} from "module";
        const require = createRequire(import.meta.url);
        {extract_code(code)}
        """
        nonlocal last_javascript_code
        last_javascript_code = with_require

        output = playground.run_javascript_code(with_require)
        result = encode_command_output(output)
        return result if len(result) > 0 else "Code execution finished without error"

    yield run_javascript_code

    @tool("CurlJavaScriptServer")
    def curl_javascript_server(empty: str) -> str:
        """
        Make a request to check if the previously run JavaScript code is a server that can handle the needed request.
        """
        nonlocal last_javascript_code
        if last_javascript_code is None:
            return "Cannot curl, you need to run code first"

        mock_request_cmd = mock.terminal_command()

        port = 3000
        (
            request_output,
            server_output,
        ) = playground.run_javascript_server_code_with_request(
            code=last_javascript_code,
            request_cmd=mock_request_cmd,
            port=port,
        )

        request_result = encode_command_output(request_output)
        server_result = encode_command_output(server_output)

        return (
            f"Curl result:\n{request_result}\nCode execution result:\n{server_result}"
        )

    yield curl_javascript_server
