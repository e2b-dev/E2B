from typing import Optional, cast

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_domains import is_supported_sandbox_domain

from e2b_code_interpreter.constants import JUPYTER_PORT


def get_jupyter_url(
    config: ConnectionConfig, sandbox_id: str, sandbox_domain: str
) -> str:
    # Same resolution as ConnectionConfig.get_sandbox_url, for the Jupyter port.
    sandbox_url = cast(Optional[str], config._sandbox_url)
    if sandbox_url:
        return sandbox_url
    if config.debug:
        return f"http://{config.get_host(sandbox_id, sandbox_domain, JUPYTER_PORT)}"
    if is_supported_sandbox_domain(sandbox_domain):
        return f"https://sandbox.{sandbox_domain}"
    return f"https://{config.get_host(sandbox_id, sandbox_domain, JUPYTER_PORT)}"
