"""Prefixed, human-legible IDs for E2B resources.

An ID is a three-character kind prefix, an underscore, and the 26-character
rotated base32 encoding of a UUID::

    prj_uk75vf2v7iagp2kgn7pfze3car
    ^^^ ^
    |   the encoding of the resource's UUID
    the kind

The prefix is what makes an ID readable in a log line, a URL or a support
ticket: you can tell at a glance which resource it points at, and a project ID
pasted where a volume ID belongs fails loudly instead of looking up a row that
happens to exist.
"""

from __future__ import annotations

import re
import uuid as uuidlib
from dataclasses import dataclass
from typing import Dict, Literal, Mapping, Optional, TypeAlias, Union, get_args

from .codec import ENCODED_LENGTH, decode_bytes, encode_bytes, fault_in_encoded
from .errors import InvalidIdException
from .uuids import create_uuid

#: A resource kind that has IDs, e.g. ``"project"``.
IdKind: TypeAlias = Literal[
    "project", "workspace", "volume", "sandbox", "user", "group"
]

#: The E2B resources that have IDs, and the prefix each one carries.
#:
#: This map is the single source of truth for the prefixes; adding a kind is
#: adding a line here and a member to :data:`IdKind`.
ID_PREFIXES: Mapping[IdKind, str] = {
    "project": "prj",
    "workspace": "wrk",
    "volume": "vol",
    "sandbox": "sbx",
    "user": "usr",
    "group": "grp",
}

# `IdKind` has to be spelled out — a Literal cannot be derived from a dict the
# way TypeScript's `keyof typeof` derives it — so the two are checked against each
# other at import. Without this, adding a kind to the Literal and forgetting the
# map typechecks clean and raises in production.
if set(get_args(IdKind)) != set(ID_PREFIXES):
    raise RuntimeError(
        "e2b_id: IdKind and ID_PREFIXES disagree: "
        f"{sorted(set(get_args(IdKind)) ^ set(ID_PREFIXES))} is in one but not the other."
    )

# What separates the prefix from the encoding.
_SEPARATOR = "_"

#: How wide every prefix is. The parsing paths do not depend on it — they find
#: the separator and slice by the matched prefix's own length — but IDs are a
#: fixed width only as long as this holds, so it is checked rather than assumed.
PREFIX_LENGTH = 3

for _prefix in ID_PREFIXES.values():
    if len(_prefix) != PREFIX_LENGTH:
        raise RuntimeError(
            f'e2b_id: the prefix "{_prefix}" is {len(_prefix)} characters, not '
            f"{PREFIX_LENGTH}, so ID_LENGTH would be wrong for its kind."
        )

#: The width of every ID: a three-character prefix, an underscore and 26
#: characters of encoding.
#:
#: Useful for sizing a database column or aligning a log. It is not a validator —
#: a string of this length can still be nonsense — so reach for :func:`is_id`
#: when the question is whether an ID is well formed.
ID_LENGTH = PREFIX_LENGTH + len(_SEPARATOR) + ENCODED_LENGTH

# Prefix to kind, for reading an ID's prefix back.
_KINDS_BY_PREFIX: Dict[str, IdKind] = {
    prefix: kind for kind, prefix in ID_PREFIXES.items()
}

# The canonical 8-4-4-4-12 hex form, accepted in either case. UUIDs are held to
# one spelling for the same reason encodings are: `uuid.UUID` would also take
# unhyphenated, braced and `urn:uuid:`-prefixed strings, and accepting four
# spellings of an argument is how two systems end up disagreeing about whether
# they hold the same value.
_UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\Z",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ParsedId:
    """A parsed ID: which kind it names, and the UUID it carries."""

    #: The resource kind its prefix names.
    kind: IdKind
    #: The UUID it encodes.
    uuid: uuidlib.UUID


def _prefix_of(kind: IdKind) -> str:
    prefix: Optional[str] = ID_PREFIXES.get(kind)
    if prefix is None:
        known = ", ".join(f"'{name}'" for name in sorted(ID_PREFIXES))
        raise InvalidIdException(
            "kind",
            f"'{kind}' is not a resource kind that has IDs. Expected one of {known}.",
        )
    return prefix


def _bytes_of(uuid: Union[uuidlib.UUID, str]) -> bytes:
    if isinstance(uuid, uuidlib.UUID):
        return uuid.bytes
    if isinstance(uuid, str) and _UUID_PATTERN.match(uuid):
        return uuidlib.UUID(uuid).bytes
    raise InvalidIdException(
        "uuid",
        f'"{uuid}" is not a UUID: expected 32 hex digits grouped 8-4-4-4-12, '
        'like "019fa519-bf79-724d-8811-a2bfda9755fa".',
    )


def encode_id(kind: IdKind, uuid: Union[uuidlib.UUID, str]) -> str:
    """Encode a UUID as an ID of the given kind.

    :param kind: the resource the UUID belongs to.
    :param uuid: the resource's UUID, as a :class:`uuid.UUID` or in canonical
        hex form.
    :return: the ID.
    :raises InvalidIdException: if ``kind`` is not a known kind, or ``uuid`` is
        not a UUID.

    Example::

        encode_id("project", "019fa519-bf79-724d-8811-a2bfda9755fa")
        # 'prj_uk75vf2v7iagp2kgn7pfze3car'
    """
    return f"{_prefix_of(kind)}{_SEPARATOR}{encode_bytes(_bytes_of(uuid))}"


def decode_id(kind: IdKind, id: str) -> uuidlib.UUID:
    """Decode an ID of the given kind back to its UUID.

    The kind is required rather than inferred so that a mismatch is an error:
    this is the check that stops one resource's ID from being used as another's.
    Use :func:`parse_id` when the kind is what you are trying to find out.

    :param kind: the resource the ID must name.
    :param id: the ID.
    :return: the UUID it carries.
    :raises InvalidIdException: if ``id`` names a different kind, or is not a
        well-formed ID.

    Example::

        decode_id("project", "prj_uk75vf2v7iagp2kgn7pfze3car")
        # UUID('019fa519-bf79-724d-8811-a2bfda9755fa')
    """
    prefix = _prefix_of(kind)
    if not id.startswith(prefix + _SEPARATOR):
        named = _KINDS_BY_PREFIX.get(id.split(_SEPARATOR)[0])
        if named is not None:
            raise InvalidIdException(
                "prefix", f'"{id}" is a {named} ID, not a {kind} ID.', named
            )
        raise InvalidIdException(
            "prefix",
            f'"{id}" is not a {kind} ID: '
            f'expected it to start with "{prefix}{_SEPARATOR}".',
        )
    return uuidlib.UUID(bytes=decode_bytes(id[len(prefix) + len(_SEPARATOR) :]))


def create_id(kind: IdKind) -> str:
    """Mint an ID for a new resource of the given kind, from a fresh
    :func:`create_uuid` UUIDv7.

    :param kind: the resource being created.
    :return: the ID.
    :raises InvalidIdException: if ``kind`` is not a known kind.

    Example::

        create_id("sandbox")  # 'sbx_blo7looa3eagp2kgn75n47fkrk'
    """
    return encode_id(kind, create_uuid())


def parse_id(id: str) -> ParsedId:
    """Read an ID without knowing its kind up front.

    :param id: the ID.
    :return: the kind its prefix names and the UUID it carries.
    :raises InvalidIdException: if ``id`` carries no known prefix, or the rest
        of it is not a well-formed encoding.

    Example::

        parse_id("vol_uxl2sotjfiagp2kgn7yv4e3e4g")
        # ParsedId(kind='volume', uuid=UUID('019fa519-bfc5-784d-9386-a5d7a93a692a'))
    """
    prefix, separator, _ = id.partition(_SEPARATOR)
    if not separator:
        raise InvalidIdException(
            "prefix",
            f'"{id}" is not an ID: expected a kind prefix and an underscore, '
            f'like "prj{_SEPARATOR}".',
        )

    kind = _KINDS_BY_PREFIX.get(prefix)
    if kind is None:
        known = ", ".join(f'"{name}"' for name in sorted(ID_PREFIXES.values()))
        raise InvalidIdException(
            "prefix",
            f'"{id}" carries the unknown prefix "{prefix}". Expected one of {known}.',
        )

    return ParsedId(kind=kind, uuid=decode_id(kind, id))


def is_id(kind: IdKind, value: str) -> bool:
    """Whether a string is a well-formed ID of the given kind.

    This is :func:`decode_id` without the raise, for validating input you did
    not mint: it checks the prefix, the width, the alphabet and the canonical
    spelling.

    It answers without building an exception or constructing a
    :class:`uuid.UUID`, so it is cheap enough to run over a whole request —
    which matters, because rejection is the common case for untrusted input and
    raising costs far more than the check itself.

    Anything that is not a :class:`str` is simply not an ID, so ``None``, an
    ``int`` and ``bytes`` all return ``False`` rather than raising
    ``AttributeError`` — this is usually the first thing a handler calls on a
    JSON payload, and it matches ``isId`` in ``@e2b/id``.

    :param kind: the resource the ID must name.
    :param value: the string to check.
    :return: whether ``value`` is an ID of that kind.

    Example::

        if not is_id("project", untrusted):
            raise ValueError(f"{untrusted} is not a project ID")
    """
    if not isinstance(value, str):
        return False

    prefix = ID_PREFIXES.get(kind)
    if prefix is None or not value.startswith(prefix + _SEPARATOR):
        return False

    return fault_in_encoded(value[len(prefix) + len(_SEPARATOR) :]) is None
