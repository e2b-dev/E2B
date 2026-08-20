from typing import Dict, Type, TypeVar, cast

from typing_extensions import Unpack

from e2b.connection_config import ApiParams
from e2b.sandbox_async.main import AsyncSandbox
from e2b.sandbox_sync.main import Sandbox
from e2b.secret import AsyncSecret, Secret
from e2b.template_async.main import AsyncTemplate
from e2b.template_sync.main import Template
from e2b.volume.volume_async import AsyncVolume
from e2b.volume.volume_sync import Volume

T = TypeVar("T")


def _bind(cls: Type[T], api_params: ApiParams) -> Type[T]:
    """Generate a subclass of ``cls`` carrying ``api_params`` as its bound params."""
    return cast(
        Type[T],
        type(cls.__name__, (cls,), {"_bound_api_params": api_params}),
    )


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

    def __init__(self, **opts: Unpack[ApiParams]):
        """
        Create a new client with the API params bound to it.

        :param opts: API params used as the defaults for every call made
            through this client's resource classes.
        """
        # Params are copied so later mutations of the caller's dicts cannot
        # change the bound configuration.
        api_params = cast(ApiParams, dict(cast(Dict[str, object], opts)))

        self.Sandbox = _bind(Sandbox, api_params)
        """`Sandbox` class bound to this client's connection configuration."""

        self.AsyncSandbox = _bind(AsyncSandbox, api_params)
        """`AsyncSandbox` class bound to this client's connection configuration."""

        self.Volume = _bind(Volume, api_params)
        """`Volume` class bound to this client's connection configuration."""

        self.AsyncVolume = _bind(AsyncVolume, api_params)
        """`AsyncVolume` class bound to this client's connection configuration."""

        self.Template = _bind(Template, api_params)
        """`Template` class bound to this client's connection configuration."""

        self.AsyncTemplate = _bind(AsyncTemplate, api_params)
        """`AsyncTemplate` class bound to this client's connection configuration."""

        self.Secret = _bind(Secret, api_params)
        """`Secret` class bound to this client's connection configuration."""

        self.AsyncSecret = _bind(AsyncSecret, api_params)
        """`AsyncSecret` class bound to this client's connection configuration."""
