from typing_extensions import Unpack

from e2b.connection_config import ApiParams
from e2b.sandbox_async.main import AsyncSandbox
from e2b.sandbox_sync.main import Sandbox
from e2b.secret import AsyncSecret, Secret
from e2b.template_async.main import AsyncTemplate
from e2b.template_sync.main import Template
from e2b.volume.volume_async import AsyncVolume
from e2b.volume.volume_sync import Volume


class E2BClientParams(ApiParams, total=False):
    """Params bound to an :class:`E2B` client, used as the defaults for every
    call made through its resource classes. Same shape as :class:`ApiParams`."""


class E2B:
    """
    E2B client with an explicitly bound connection configuration.

    The resource classes exposed by the client (`Sandbox`, `AsyncSandbox`,
    `Volume`, `AsyncVolume`, `Template`, `AsyncTemplate`, `Secret`,
    `AsyncSecret`) behave exactly like the top-level exports of the same name,
    except the params passed to the client are used as the defaults instead of
    the environment variables.
    Per-call params still take precedence over the client's params.

    Multiple clients are fully isolated from each other and from the top-level
    env-configured exports.

    Example:
    ```python
    from e2b import E2B

    client = E2B(api_key="e2b_...", domain="e2b.dev")

    sandbox = client.Sandbox.create()
    volumes = client.Volume.list()
    exists = client.Template.exists("my-template")
    ```
    """

    def __init__(self, **opts: Unpack[E2BClientParams]):
        """
        Create a new client with the API params bound to it.

        :param opts: API params used as the defaults for every call made
            through this client's resource classes.
        """
        self.Sandbox = Sandbox._with_params(**opts)
        """`Sandbox` class bound to this client's connection configuration."""

        self.AsyncSandbox = AsyncSandbox._with_params(**opts)
        """`AsyncSandbox` class bound to this client's connection configuration."""

        self.Volume = Volume._with_params(**opts)
        """`Volume` class bound to this client's connection configuration."""

        self.AsyncVolume = AsyncVolume._with_params(**opts)
        """`AsyncVolume` class bound to this client's connection configuration."""

        self.Template = Template._with_params(**opts)
        """`Template` class bound to this client's connection configuration."""

        self.AsyncTemplate = AsyncTemplate._with_params(**opts)
        """`AsyncTemplate` class bound to this client's connection configuration."""

        self.Secret = Secret._with_params(**opts)
        """`Secret` class bound to this client's connection configuration."""

        self.AsyncSecret = AsyncSecret._with_params(**opts)
        """`AsyncSecret` class bound to this client's connection configuration."""
