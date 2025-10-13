class ReadyCmd:
    """
    Wrapper class for ready check commands.

    Ready commands are shell commands that determine when a sandbox is ready to use
    after the start command begins execution. They run repeatedly until they succeed
    (exit with code 0) or timeout.
    """

    def __init__(self, cmd: str):
        """
        Create a new ReadyCmd instance.

        Args:
            cmd: Shell command to execute for readiness check
        """
        self.__cmd = cmd

    def get_cmd(self):
        """
        Get the shell command string.

        Returns:
            The ready check command
        """
        return self.__cmd


def wait_for_port(port: int):
    """
    Wait for a port to be listening.

    Uses `ss` command to check if a port is open and listening.

    Args:
        port: Port number to wait for

    Returns:
        ReadyCmd that checks for the port

    Example:
        ```python
        from e2b import Template, wait_for_port

        template = Template()
        builder = template.from_python_image()
        builder.set_start_cmd('python -m http.server 8000', wait_for_port(8000))
        ```
    """
    cmd = f"ss -tuln | grep :{port}"
    return ReadyCmd(cmd)


def wait_for_url(url: str, status_code: int = 200):
    """
    Wait for a URL to return a specific HTTP status code.

    Uses `curl` to make HTTP requests and check the response status.

    Args:
        url: URL to check (e.g., 'http://localhost:3000/health')
        status_code: Expected HTTP status code (default: 200)

    Returns:
        ReadyCmd that checks the URL

    Example:
        ```python
        from e2b import Template, wait_for_url

        template = Template()
        builder = template.from_node_image()
        builder.set_start_cmd('npm start', wait_for_url('http://localhost:3000/health'))
        ```
    """
    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
    return ReadyCmd(cmd)


def wait_for_process(process_name: str):
    """
    Wait for a process with a specific name to be running.

    Uses `pgrep` to check if a process exists.

    Args:
        process_name: Name of the process to wait for

    Returns:
        ReadyCmd that checks for the process

    Example:
        ```python
        from e2b import Template, wait_for_process

        template = Template()
        builder = template.from_base_image()
        builder.set_start_cmd('./my-daemon', wait_for_process('my-daemon'))
        ```
    """
    cmd = f"pgrep {process_name} > /dev/null"
    return ReadyCmd(cmd)


def wait_for_file(filename: str):
    """
    Wait for a file to exist.

    Uses shell test command to check file existence.

    Args:
        filename: Path to the file to wait for

    Returns:
        ReadyCmd that checks for the file

    Example:
        ```python
        from e2b import Template, wait_for_file

        template = Template()
        builder = template.from_base_image()
        builder.set_start_cmd('./init.sh', wait_for_file('/tmp/ready'))
        ```
    """
    cmd = f"[ -f {filename} ]"
    return ReadyCmd(cmd)


def wait_for_timeout(timeout: int):
    """
    Wait for a specified timeout before considering the sandbox ready.

    Uses `sleep` command to wait for a fixed duration.

    Args:
        timeout: Time to wait in milliseconds (minimum: 1000ms / 1 second)

    Returns:
        ReadyCmd that waits for the specified duration

    Example:
        ```python
        from e2b import Template, wait_for_timeout

        template = Template()
        builder = template.from_node_image()
        builder.set_start_cmd('npm start', wait_for_timeout(5000))  # Wait 5 seconds
        ```
    """
    # convert to seconds, but ensure minimum of 1 second
    seconds = max(1, timeout // 1000)
    cmd = f"sleep {seconds}"
    return ReadyCmd(cmd)
