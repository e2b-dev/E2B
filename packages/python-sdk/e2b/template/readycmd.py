class ReadyCmd:
    @classmethod
    def wait_for_port(cls, port: int) -> str:
        """Generate a command to wait for a port to be available."""
        return f"ss -tuln | grep :{port}"

    @classmethod
    def wait_for_url(cls, url: str, status_code: int = 200) -> str:
        """Generate a command to wait for a URL to return a specific status code."""
        return (
            f'curl -s -o /dev/null -w "%{{http_code}}" {url} | grep -q "{status_code}"'
        )

    @classmethod
    def wait_for_process(cls, process_name: str) -> str:
        """Generate a command to wait for a process to be running."""
        return f"pgrep {process_name} > /dev/null"

    @classmethod
    def wait_for_file(cls, filename: str) -> str:
        """Generate a command to wait for a file to exist."""
        return f"[ -f {filename} ]"

    @classmethod
    def wait_for_timeout(cls, timeout: int) -> str:
        """Generate a command to wait for a specified duration."""
        # convert to seconds, but ensure minimum of 1 second
        seconds = max(1, timeout // 1000)
        return f"sleep {seconds}"
