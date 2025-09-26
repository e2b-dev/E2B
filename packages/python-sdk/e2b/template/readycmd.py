class ReadyCmd:
    def __init__(self, cmd: str):
        self.__cmd = cmd

    def get_cmd(self):
        return self.__cmd


def wait_for_port(port: int):
    """Generate a command to wait for a port to be available."""
    cmd = f"ss -tuln | grep :{port}"
    return ReadyCmd(cmd)


def wait_for_url(url: str, status_code: int = 200):
    """Generate a command to wait for a URL to return a specific status code."""
    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
    return ReadyCmd(cmd)


def wait_for_process(process_name: str):
    """Generate a command to wait for a process to be running."""
    cmd = f"pgrep {process_name} > /dev/null"
    return ReadyCmd(cmd)


def wait_for_file(filename: str):
    """Generate a command to wait for a file to exist."""
    cmd = f"[ -f {filename} ]"
    return ReadyCmd(cmd)


def wait_for_timeout(timeout: int):
    """Generate a command to wait for a specified duration."""
    # convert to seconds, but ensure minimum of 1 second
    seconds = max(1, timeout // 1000)
    cmd = f"sleep {seconds}"
    return ReadyCmd(cmd)
