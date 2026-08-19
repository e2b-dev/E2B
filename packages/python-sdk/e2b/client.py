from typing import Type, cast

from typing_extensions import Unpack

from e2b.connection_config import ApiParams
from e2b.sandbox_async.main import AsyncSandbox
from e2b.sandbox_sync.main import Sandbox
from e2b.secret import Secret
from e2b.template_async.main import AsyncTemplate
from e2b.template_sync.main import Template
from e2b.volume.volume_async import AsyncVolume
from e2b.volume.volume_sync import Volume


class E2B:
    """
    E2B client bound to its own connection options.

    Exposes ``Sandbox``, ``Volume``, ``Secret``, ``Template`` and their async
    counterparts as classes whose class-level API methods use the client's
    connection options instead of the environment-derived defaults.
    Per-call options still override the client's options.

    Example
    ```python
    from e2b import E2B

    client = E2B(api_key="other-api-key")
    sbx = client.Sandbox.create()
    ```

    The top-level imports (``from e2b import Sandbox, Volume, Secret``) keep
    working and use the default configuration from environment variables.
    """

    Sandbox: Type[Sandbox]
    AsyncSandbox: Type[AsyncSandbox]
    Volume: Type[Volume]
    AsyncVolume: Type[AsyncVolume]
    Template: Type[Template]
    AsyncTemplate: Type[AsyncTemplate]
    Secret: Type[Secret]

    def __init__(self, **opts: Unpack[ApiParams]):
        defaults = cast(ApiParams, dict(opts))

        self.Sandbox = type(
            "Sandbox", (Sandbox,), {"_default_connection_opts": defaults}
        )
        self.AsyncSandbox = type(
            "AsyncSandbox", (AsyncSandbox,), {"_default_connection_opts": defaults}
        )
        self.Volume = type("Volume", (Volume,), {"_default_connection_opts": defaults})
        self.AsyncVolume = type(
            "AsyncVolume", (AsyncVolume,), {"_default_connection_opts": defaults}
        )
        self.Template = type(
            "Template", (Template,), {"_default_connection_opts": defaults}
        )
        self.AsyncTemplate = type(
            "AsyncTemplate", (AsyncTemplate,), {"_default_connection_opts": defaults}
        )
        # Secret is stateless and does not make API calls.
        self.Secret = Secret
