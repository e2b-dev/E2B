from e2b.sandbox.sandbox_api import SandboxIamToken


class Secret:
    """
    Secrets and workload identity helpers.
    """

    @staticmethod
    def id_token(*, audience: str, token_type: str) -> SandboxIamToken:
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
                    "aws": Secret.id_token(
                        audience="sts.amazonaws.com",
                        token_type="JWT-SVID",
                    ),
                },
            },
        )
        ```
        """
        return SandboxIamToken(audience=audience, token_type=token_type)
