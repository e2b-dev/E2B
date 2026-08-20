from e2b.connection_config import ApiParams
from e2b.paginator import PaginatorBase
from e2b.sandbox.sandbox_api import SandboxIamToken, SandboxIamTokenType
from e2b.secret.types import SecretInfo


class SecretPaginatorBase(PaginatorBase[SecretInfo, ApiParams]):
    pass


class SecretBase:
    """
    Module for managing E2B secrets and workload identity helpers.

    Secret values are write-only: they are accepted by ``create`` and
    ``update`` but never returned by any read surface.
    """

    @staticmethod
    def fill(secret: str) -> str:
        """
        Format a placeholder that the runtime resolves to the secret's
        current value.

        This is a local formatting helper and makes no network call — it does
        not check whether the named secret exists. An unknown reference fails
        server-side when the placeholder is resolved.

        :param secret: Secret name.

        :return: Placeholder string resolving to the secret's value.

        Example:
        ```python
        Secret.fill("openai-api-key")
        # '${e2b.secrets.openai-api-key}'
        ```
        """
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
