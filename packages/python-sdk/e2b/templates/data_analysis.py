import logging
import time
from typing import Optional, Callable, Any, Tuple, List, Union
from e2b.sandbox.process import ProcessMessage

from pydantic import BaseModel, PrivateAttr

from e2b import EnvVars, Sandbox
from e2b.constants import TIMEOUT

logger = logging.getLogger(__name__)


class Artifact(BaseModel):
    name: str
    _sandbox: Sandbox = PrivateAttr()

    def __init__(self, sandbox: Sandbox, **data: Any):
        super().__init__(**data)
        self._sandbox = sandbox

    def __hash__(self):
        return hash(self.name)

    def download(self) -> bytes:
        return self._sandbox.download_file(self.name)


class DataAnalysis(Sandbox):
    env_id = "Python3-DataAnalysis"

    def __init__(
        self,
        api_key: Optional[str] = None,
        cwd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        timeout: Optional[float] = TIMEOUT,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_artifact: Optional[Callable[[Artifact], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        **kwargs,
    ):
        self.on_artifact = on_artifact
        super().__init__(
            id=self.env_id,
            api_key=api_key,
            cwd=cwd,
            env_vars=env_vars,
            timeout=timeout,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            **kwargs,
        )

    def run_python(
        self,
        code: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_artifact: Optional[Callable[[Artifact], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        cwd: str = "",
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Tuple[str, str, List[Artifact]]:
        artifacts = set()

        def register_artifacts(event: Any) -> None:
            on_artifact_func = on_artifact or self.on_artifact
            if event.operation == "Create":
                artifact = Artifact(name=event.path, sandbox=self)
                artifacts.add(artifact)
                if on_artifact_func:
                    try:
                        on_artifact_func(artifact)
                    except Exception as e:
                        logger.error("Failed to process artifact", exc_info=e)

        watcher = self.filesystem.watch_dir("/home/user/artifacts")
        watcher.add_event_listener(register_artifacts)
        watcher.start()

        epoch_time = time.time()
        codefile_path = f"/tmp/main-{epoch_time}.py"
        self.filesystem.write(codefile_path, code)

        process = self.process.start(
            f"python {codefile_path}",
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            env_vars=env_vars,
            cwd=cwd,
            process_id=process_id,
            timeout=timeout,
        )
        process.wait()

        watcher.stop()

        return process.output.stdout, process.output.stderr, list(artifacts)

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

    def install_python_packages(
        self, package_names: Union[str, List[str]], timeout: Optional[float] = TIMEOUT
    ) -> None:
        self._install_packages("pip install", package_names, timeout=timeout)

    def install_system_packages(
        self, package_names: Union[str, List[str]], timeout: Optional[float] = TIMEOUT
    ) -> None:
        self._install_packages(
            "sudo apt-get install -y", package_names, timeout=timeout
        )


CodeInterpreter = DataAnalysis
