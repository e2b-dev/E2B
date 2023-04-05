from codegen.tools.async_tool import async_tool
from session.playground import NodeJSPlayground
from codegen.tools.playground.tools.process import encode_command_output


def extract_code(code: str):
    return code.strip().strip("`").strip()


def create_code_tools(playground: NodeJSPlayground):
    last_javascript_code: str | None = None

    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @async_tool("InstallNPMDependencies")
    async def install_dependencies(dependencies: str) -> str:
        """Install JavaScript packages with NPM. The input should be valid names of NPM packages."""
        output = await playground.install_dependencies(extract_code(dependencies))
        result = encode_command_output(output, only_errors=True)
        return result if len(result) > 0 else "All dependencies installed"

    yield install_dependencies

    # A tool for executing index.mjs file
    @async_tool("RunSavedCode")
    async def run_saved_code(empty: str) -> str:
        """Run JavaScript code that is inside the index.mjs. The tool takes no input."""
        output = await playground.run_saved_javascript_code()
        return encode_command_output(output)

    yield run_saved_code

    # A tool for writing JavaScript code specifically to the index.mjs file
    @async_tool("WriteJavaScriptCode")
    async def write_javascript_code(code: str) -> str:
        """Write JavaScript code to the index.mjs file. The input should be valid JavaScript code."""
        nonlocal last_javascript_code
        last_javascript_code = code

        await playground.write_javascript_code(extract_code(code))
        return "Code written to index.mjs"

    yield write_javascript_code

    # # This tool is just for executing JavaScript without doing the request to server
    # @async_tool("RunJavaScriptCode")
    # async def run_javascript_code(code: str) -> str:
    #     """
    #     Run JavaScript code as ECMAScript module and return output.
    #     Input should be a valid JavaScript code. Example usage:
    #     <action tool="RunJavaScriptCode">
    #     console.log('hello world')
    #     </action>
    #     """
    #     await playground.update_envs()

    #     nonlocal last_javascript_code
    #     last_javascript_code = code

    #     output = await playground.run_javascript_code(code)
    #     result = encode_command_output(output)
    #     return result if len(result) > 0 else "Code execution finished without error"

    # yield run_javascript_code

    @async_tool("Curl")
    async def curl(curl_command: str) -> str:
        """Make a curl request. The input should be the `curl` command."""
        await playground.update_envs()

        nonlocal last_javascript_code
        if last_javascript_code is None:
            return "Cannot curl, you need to write code first"

        port = 3000
        (
            request_output,
            server_output,
        ) = await playground.run_javascript_server_code_with_request(
            code=last_javascript_code,
            request_cmd=curl_command.strip(),
            port=port,
        )

        request_result = encode_command_output(request_output)
        server_result = encode_command_output(server_output)

        return f"Curl output:\n{request_result}\nServer output:\n{server_result}"

    yield curl

    # @async_tool("CurlJavaScriptServer")
    # async def curl_javascript_server(curl_command: str) -> str:
    #     """
    #     Make a curl request. The input should be the `curl` command. Example usage:
    #     <action tool="CurlJavaScriptServer">
    #     curl --no-progress-meter -X POST -H "Content-Type: application/json" -d '{{"key": "value"}}' http://localhost:3000/
    #     </action>
    #     """
    #     # """
    #     # Make a request to check if the previously run JavaScript code is a server that can handle the needed request. This tool has no input. Example usage:
    #     # ```
    #     # <action tool="CurlJavaScriptServer">
    #     # </action>
    #     # ```"""
    #     await playground.update_envs()

    #     nonlocal last_javascript_code
    #     if last_javascript_code is None:
    #         return "Cannot curl, you need to run code first"

    #     port = 3000
    #     (
    #         request_output,
    #         server_output,
    #     ) = await playground.run_javascript_server_code_with_request(
    #         code=last_javascript_code,
    #         request_cmd=curl_command.strip(),
    #         port=port,
    #     )

    #     request_result = encode_command_output(request_output)
    #     server_result = encode_command_output(server_output)

    #     return f"Curl output:\n{request_result}\nServer output:\n{server_result}"

    # yield curl_javascript_server
