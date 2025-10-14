class ReadyCmd:
    """
    Wrapper class for ready check commands.
    """

    def __init__(self, cmd: str):
        self.__cmd = cmd

    def get_cmd(self):
        return self.__cmd


def wait_for_port(port: int):
    """
    Wait for a port to be listening.

    Uses `ss` command to check if a port is open and listening.

    :param port: Port number to wait for

    :return: ReadyCmd that checks for the port

    Example
    ```python
    from e2b import Template, wait_for_port

    template = (
        Template()
        .from_python_image()
        .set_start_cmd('python -m http.server 8000', wait_for_port(8000))
    )
    ```
    """
    cmd = f"ss -tuln | grep :{port}"
    return ReadyCmd(cmd)


def wait_for_url(url: str, status_code: int = 200):
    """
    Wait for a URL to return a specific HTTP status code.

    Uses `curl` to make HTTP requests and check the response status.

    :param url: URL to check (e.g., 'http://localhost:3000/health')
    :param status_code: Expected HTTP status code (default: 200)

    :return: ReadyCmd that checks the URL

    Example
    ```python
    from e2b import Template, wait_for_url

    template = (
        Template()
        .from_node_image()
        .set_start_cmd('npm start', wait_for_url('http://localhost:3000/health'))
    )
    ```
    """
    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
    return ReadyCmd(cmd)


def wait_for_process(process_name: str):
    """
    Wait for a process with a specific name to be running.

    Uses `pgrep` to check if a process exists.

    :param process_name: Name of the process to wait for

    :return: ReadyCmd that checks for the process

    Example
    ```python
    from e2b import Template, wait_for_process

    template = (
        Template()
        .from_base_image()
        .set_start_cmd('./my-daemon', wait_for_process('my-daemon'))
    )
    ```
    """
    cmd = f"pgrep {process_name} > /dev/null"
    return ReadyCmd(cmd)


def wait_for_file(filename: str):
    """
    Wait for a file to exist.

    Uses shell test command to check file existence.

    :param filename: Path to the file to wait for

    :return: ReadyCmd that checks for the file

    Example
    ```python
    from e2b import Template, wait_for_file

    template = (
        Template()
        .from_base_image()
        .set_start_cmd('./init.sh', wait_for_file('/tmp/ready'))
    )
    ```
    """
    cmd = f"[ -f {filename} ]"
    return ReadyCmd(cmd)


def wait_for_timeout(timeout: int):
    """
    Wait for a specified timeout before considering the sandbox ready.

    Uses `sleep` command to wait for a fixed duration.

    :param timeout: Time to wait in **milliseconds** (minimum: 1000ms / 1 second)

    :return: ReadyCmd that waits for the specified duration

    Example
    ```python
    from e2b import Template, wait_for_timeout

    template = (
        Template()
        .from_node_image()
        .set_start_cmd('npm start', wait_for_timeout(5000))  # Wait 5 seconds
    )
    ```
    """
    # convert to seconds, but ensure minimum of 1 second
    seconds = max(1, timeout // 1000)
    cmd = f"sleep {seconds}"
    return ReadyCmd(cmd)
