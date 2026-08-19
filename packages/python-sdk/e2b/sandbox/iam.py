"""
Workload identity (iam) helpers for E2B sandboxes.
"""

import re
from typing import Iterable, Iterator, Mapping

from e2b.exceptions import InvalidArgumentException


# Characters a workload token name cannot carry.
#
# The egress proxy reads a placeholder as everything between
# "${e2b.identity.tokens." and the next "}", then looks that name up in the
# registered tokens. A brace in the name breaks that in both directions: "}"
# ends the placeholder early, so "a}b" resolves the unrelated token "a" and
# leaves "b}" as literal text, and "{" lets a name close its own placeholder and
# open another one, minting a token the caller never referenced. Control
# characters are rejected separately because they cannot appear in an HTTP
# header value at all — the API would answer with an opaque 400. The class is
# the Unicode Control category (U+0000-U+001F, U+007F-U+009F), spelled
# `\p{Cc}` in the JS SDK.
INVALID_IAM_TOKEN_NAME_CHARS = re.compile(r"[{}\x00-\x1f\x7f-\x9f]")


def validate_iam_token_name(name: str) -> None:
    if (
        not isinstance(name, str)
        or not name
        or INVALID_IAM_TOKEN_NAME_CHARS.search(name)
    ):
        raise InvalidArgumentException(
            f"iam token name {name!r} is not usable: a token name must be a "
            "non-empty string and cannot contain '{', '}' or control "
            "characters, because it is interpolated into the "
            "'${e2b.identity.tokens.<name>}' placeholder the egress proxy "
            "resolves."
        )


def iam_token_placeholder(name: str) -> str:
    validate_iam_token_name(name)

    return f"${{e2b.identity.tokens.{name}}}"


class IamTokenPlaceholders(Mapping[str, str]):
    """
    Workload token placeholders keyed by token name, as exposed to a
    ``transform`` callable. Every lookup — ``[name]``, ``get(name)`` — resolves
    through :meth:`__getitem__`, so an unregistered name cannot slip through as
    ``None``; iteration and ``in`` see only the registered names. The mapping is
    read-only, because a name added or removed here would only make the guard
    lie about what the sandbox registered.

    ``validate=False`` is for the update-network endpoint, whose payload carries
    no ``iam`` config — the sandbox's registered token names are not known
    client-side there, so any name resolves to its placeholder.
    """

    def __init__(self, names: Iterable[str], *, validate: bool) -> None:
        # dict.fromkeys keeps registration order while dropping duplicates.
        self._names = tuple(dict.fromkeys(names))
        self._validate = validate

    def __getitem__(self, name: str) -> str:
        # The proxy never turns an unregistered name into a token, so a typo
        # would surface as a confusing auth failure at the destination instead
        # of an error here.
        if not self._validate or name in self._names:
            return iam_token_placeholder(name)

        hint = (
            f"Registered tokens: {', '.join(repr(known) for known in self._names)}."
            if self._names
            else (
                f"Pass it to Sandbox.create as iam={{'tokens': "
                f"{{{name!r}: Secret.iam_token(audience=..., token_type=...)}}}}."
            )
        )
        raise InvalidArgumentException(
            f"Network transform references iam token {name!r}, which is not "
            f"registered. {hint}"
        )

    def __setitem__(self, name: str, value: object) -> None:
        # Writing here cannot register anything: the name would resolve to a
        # placeholder the egress proxy has no token for, and the request would
        # go out with an unresolved header instead of failing here. The JS SDK
        # rejects an assignment to `iam.tokens` for the same reason.
        raise InvalidArgumentException(
            f"Cannot assign iam token {name!r}: ctx.iam.tokens is a read-only "
            "view of the tokens the sandbox registers. Register it as "
            f"iam={{'tokens': {{{name!r}: Secret.iam_token(audience=..., "
            "token_type=...)}} instead — a name assigned here resolves to a "
            "placeholder the egress proxy has no token for."
        )

    def __delitem__(self, name: str) -> None:
        # Dropping a name here would only make the guard contradict the
        # sandbox, reporting a registered token as unregistered.
        raise InvalidArgumentException(
            f"Cannot delete iam token {name!r}: ctx.iam.tokens is a read-only "
            "view of the tokens the sandbox registers. Drop it from the "
            "sandbox's iam config instead."
        )

    def __contains__(self, name: object) -> bool:
        # Membership answers "is this registered?" and never raises, so callables
        # can branch on it; mirrors `name in iam.tokens` in the JS SDK.
        return name in self._names

    def __iter__(self) -> Iterator[str]:
        return iter(self._names)

    def __len__(self) -> int:
        return len(self._names)
