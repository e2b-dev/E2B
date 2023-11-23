from typing import Optional, List, Union, Callable, Any, Literal

from e2b import Sandbox, EnvVars, ProcessMessage, OpenPort
from e2b.constants import TIMEOUT


class BaseTemplate(Sandbox):
    sandbox_template_id: str

    def __init__(
        self,
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        timeout: Optional[float] = TIMEOUT,
        _debug_hostname: Optional[str] = None,
        _debug_port: Optional[int] = None,
        _debug_dev_env: Optional[Literal["remote", "local"]] = None,
    ):
        if self.sandbox_template_id is None:
            raise Exception("env_id is not defined")

        super().__init__(
            id=self.sandbox_template_id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            on_scan_ports=on_scan_ports,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            timeout=timeout,
            _debug_hostname=_debug_hostname,
            _debug_port=_debug_port,
            _debug_dev_env=_debug_dev_env,
        )

    def _install_packages(
        self,
        command: str,
        package_names: Union[str, List[str]],
        timeout: Optional[float] = TIMEOUT,
    ) -> None:
        if isinstance(package_names, list):
            package_names = " ".join(package_names)

        package_names = package_names.strip()
        if not package_names:
            return

        process = self.process.start(f"{command} {package_names}", timeout=timeout)
        process.wait()

        if process.exit_code != 0:
            raise Exception(
                f"Failed to install package {package_names}: {process.output.stderr}"
            )

    def install_system_packages(
        self, package_names: Union[str, List[str]], timeout: Optional[float] = TIMEOUT
    ) -> None:
        self._install_packages(
            "sudo apt-get install -y", package_names, timeout=timeout
        )
