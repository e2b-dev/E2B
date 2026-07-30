"""``e2b_id`` — prefixed, human-legible IDs for E2B resources.

::

    from e2b_id import create_id, decode_id, is_id, parse_id

    id = create_id("project")  # 'prj_uk75vf2v7iagp2kgn7pfze3car'
    decode_id("project", id)  # UUID('019fa519-bf79-724d-8811-a2bfda9755fa')
    is_id("volume", id)  # False
    parse_id(id)  # ParsedId(kind='project', uuid=UUID('019fa519-…'))

An ID is a kind prefix and the 26-character rotated base32 encoding of a UUID.
See :mod:`e2b_id.ids` for what the prefix buys and :mod:`e2b_id.codec` for what
the rotation buys. ``@e2b/id`` is the same format in TypeScript, name for name.
"""

from .codec import (
    ALPHABET,
    DECODED_LENGTH,
    ENCODED_LENGTH,
    decode_bytes,
    encode_bytes,
)
from .errors import InvalidIdException, InvalidIdReason
from .ids import (
    ID_LENGTH,
    ID_PREFIXES,
    PREFIX_LENGTH,
    IdKind,
    ParsedId,
    create_id,
    decode_id,
    encode_id,
    is_id,
    parse_id,
)
from .uuids import create_uuid

__all__ = [
    "ALPHABET",
    "DECODED_LENGTH",
    "ENCODED_LENGTH",
    "ID_LENGTH",
    "ID_PREFIXES",
    "PREFIX_LENGTH",
    "IdKind",
    "InvalidIdException",
    "InvalidIdReason",
    "ParsedId",
    "create_id",
    "create_uuid",
    "decode_bytes",
    "decode_id",
    "encode_bytes",
    "encode_id",
    "is_id",
    "parse_id",
]
