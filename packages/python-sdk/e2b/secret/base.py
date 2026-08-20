import re

from e2b.connection_config import ApiParams
from e2b.exceptions import InvalidArgumentException
from e2b.paginator import PaginatorBase
from e2b.sandbox.sandbox_api import SandboxIamToken, SandboxIamTokenType
from e2b.secret.types import SecretInfo


class SecretPaginatorBase(PaginatorBase[SecretInfo, ApiParams]):
    pass


INVALID_SECRET_NAME_CHARS = re.compile(r"[{}\x00-\x1f\x7f-\x9f]")


def _validate_secret_name(name: str) -> None:
    if not isinstance(name, str) or not name or INVALID_SECRET_NAME_CHARS.search(name):
        raise InvalidArgumentException(
            f"secret name {name!r} is not usable: a secret name must be a "
            "non-empty string and cannot contain '{', '}' or control "
            "characters, because it is interpolated into the "
            "'${e2b.secrets.<name>}' marker the egress proxy resolves."
        )


class SecretBase:
    """
    Module for managing E2B secrets and workload identity helpers.

    Secret values are write-only: they are accepted by ``create`` and
    ``update`` but never returned by any read surface.
    """

    @staticmethod
    def fill(secret: str) -> str:
        """
        Format a marker referencing the secret by name, for use in a network
        rule's request transform. The egress proxy replaces the marker with
        the secret's current value each time it forwards a matching request,
        so the value never enters the sandbox.

        This is a local formatting helper and makes no network call — it does
        not check whether the named secret exists. An unresolvable marker
        fails open: the request is still forwarded, but every header
        containing it is omitted.

        :param secret: Secret name.

        :return: Marker string the egress proxy resolves to the secret's value.

        Example:
        ```python
        sandbox = Sandbox.create(
            network={
                "rules": {
                    "api.stripe.com": [
                        {
                            "transform": {
                                "headers": {
                                    "Authorization": f"Bearer {Secret.fill('stripe_api_key')}",
                                },
                            },
                        },
                    ],
                },
            },
        )
        ```
        """
        _validate_secret_name(secret)
        return f"${{e2b.secrets.{secret}}}"

    @staticmethod
    def iam_token(*, audience: str, token_type: SandboxIamTokenType) -> SandboxIamToken:
        """
        Define a workload identity token to pass to ``iam.tokens`` when
        creating a sandbox.

        :param audience: Audience of the workload token, stored exactly as provided.
        :param token_type: Workload token type.

        :return: A token definition passable to ``iam.tokens``.

        Example:
        ```python
        sandbox = Sandbox.create(
            iam={
                "tokens": {
                    "aws": Secret.iam_token(
                        audience="sts.amazonaws.com",
                        token_type="JWT-SVID",
                    ),
                },
            },
        )
        ```
        """
        return SandboxIamToken(audience=audience, token_type=token_type)
