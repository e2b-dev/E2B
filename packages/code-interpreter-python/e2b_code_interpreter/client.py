from typing import Dict, Type, TypeVar, cast

from e2b import ApiParams
from e2b import E2B as CoreE2B
from typing_extensions import Unpack

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.code_interpreter_sync import Sandbox

T = TypeVar("T")


class E2BClientParams(ApiParams, total=False):
    """Params bound to an :class:`E2B` client, used as the defaults for every
    call made through its resource classes. Same shape as :class:`ApiParams`."""


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
    from e2b_code_interpreter import E2B

    client = E2B(api_key="e2b_...", domain="e2b.dev")

    sandbox = client.Sandbox.create()
    execution = sandbox.run_code("x = 1; x += 1; x")
    ```
    """

    def __init__(self, **opts: Unpack[E2BClientParams]):
        """
        Create a new client with the API params bound to it.

        :param opts: API params used as the defaults for every call made
            through this client's resource classes.
        """
        # Params are copied so later mutations of the caller's dicts cannot
        # change the bound configuration.
        api_params = cast(ApiParams, dict(cast(Dict[str, object], opts)))

        headers = api_params.get("headers")
        if headers is not None:
            api_params["headers"] = dict(headers)

        api_headers = api_params.get("api_headers")
        if api_headers is not None:
            api_params["api_headers"] = dict(api_headers)

        self.Sandbox = _bind(Sandbox, api_params)
        """Code Interpreter `Sandbox` class bound to this client's connection configuration."""

        self.AsyncSandbox = _bind(AsyncSandbox, api_params)
        """Code Interpreter `AsyncSandbox` class bound to this client's connection configuration."""

        # The resources that are not specific to the Code Interpreter are bound
        # by the core client.
        core = CoreE2B(**api_params)

        self.Volume = core.Volume
        """`Volume` class bound to this client's connection configuration."""

        self.AsyncVolume = core.AsyncVolume
        """`AsyncVolume` class bound to this client's connection configuration."""

        self.Template = core.Template
        """`Template` class bound to this client's connection configuration."""

        self.AsyncTemplate = core.AsyncTemplate
        """`AsyncTemplate` class bound to this client's connection configuration."""

        self.Secret = core.Secret
        """`Secret` class bound to this client's connection configuration."""

        self.AsyncSecret = core.AsyncSecret
        """`AsyncSecret` class bound to this client's connection configuration."""
