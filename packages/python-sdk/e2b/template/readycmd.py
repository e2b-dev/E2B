class ReadyCmd:
    def __init__(self, cmd: str):
        self.__cmd = cmd

    @classmethod
    def wait_for_port(cls, port: int):
        """Generate a command to wait for a port to be available."""
        cmd = f"ss -tuln | grep :{port}"
        return cls(cmd)

    @classmethod
    def wait_for_url(cls, url: str, status_code: int = 200):
        """Generate a command to wait for a URL to return a specific status code."""
        cmd = (
            f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
        )
        return cls(cmd)

    @classmethod
    def wait_for_process(cls, process_name: str):
        """Generate a command to wait for a process to be running."""
        cmd = f"pgrep {process_name} > /dev/null"
        return cls(cmd)

    @classmethod
    def wait_for_file(cls, filename: str):
        """Generate a command to wait for a file to exist."""
        cmd = f"[ -f {filename} ]"
        return cls(cmd)

    @classmethod
    def wait_for_timeout(cls, timeout: int):
        """Generate a command to wait for a specified duration."""
        # convert to seconds, but ensure minimum of 1 second
        seconds = max(1, timeout // 1000)
        cmd = f"sleep {seconds}"
        return cls(cmd)

    def get_cmd(self):
        return self.__cmd
