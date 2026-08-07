from __future__ import annotations

from typing import Literal, Optional, TypeAlias

#: Why a string was rejected. Callers that need to react differently per cause —
#: hint at the right kind, count non-canonical spellings, plain-400 the rest —
#: branch on this rather than on the message, which is prose and may be reworded.
#:
#: - ``kind``: the kind asked for is not one this package knows.
#: - ``prefix``: the ID names a different kind, or none.
#: - ``length``: the encoding is not ``ENCODED_LENGTH`` characters.
#: - ``alphabet``: it holds a character outside the lowercase base32 alphabet.
#: - ``canonical``: it decodes, but is one of the three non-canonical spellings.
#: - ``uuid``: the UUID given was not in canonical hex form.
InvalidIdReason: TypeAlias = Literal[
    "kind", "prefix", "length", "alphabet", "canonical", "uuid"
]


class InvalidIdException(ValueError):
    """Raised when a string is not a well-formed ID, encoding or UUID.

    Every failure mode of this package is one of these; :attr:`reason` says
    which. Use :func:`e2b_id.is_id` when a boolean is what you want — it does not
    construct an exception at all.

    It subclasses ``ValueError`` so that code which already guards parsing with
    ``except ValueError`` keeps working.

    :param reason: why the string was rejected.
    :param message: the human-facing explanation.
    :param actual_kind: the kind the ID's prefix actually names, when it names a
        known one — set only for ``reason="prefix"``, so ``expected X, got Y`` is
        available without parsing the message.
    """

    def __init__(
        self,
        reason: InvalidIdReason,
        message: str,
        actual_kind: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.reason: InvalidIdReason = reason
        self.actual_kind = actual_kind
