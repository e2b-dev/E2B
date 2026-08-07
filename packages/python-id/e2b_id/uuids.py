"""Minting the UUIDs that IDs are made from.

UUIDs cross this package's boundary as :class:`uuid.UUID`, and the conversion to
and from bytes is the standard library's (``u.bytes`` and ``uuid.UUID(bytes=…)``)
rather than something this package wraps.

This is where the two surfaces diverge, and it is all downstream of one fact:
JavaScript has no UUID type, so ``@e2b/id`` moves UUIDs as canonical hex strings
where this package moves :class:`uuid.UUID` objects. Concretely:

- ``@e2b/id`` exports ``uuidToBytes``/``bytesToUuid``; there is no equivalent
  here, because the standard library already is the equivalent.
- :func:`create_uuid` returns a :class:`uuid.UUID`; ``createUuid`` returns a
  string.
- :func:`e2b_id.decode_id` returns a :class:`uuid.UUID` and
  :attr:`e2b_id.ParsedId.uuid` is one, where ``decodeId`` and ``ParsedId.uuid``
  are strings — so a round trip is string-to-string in JS but not in Python.
- :func:`e2b_id.encode_id` accepts either a :class:`uuid.UUID` or the hex form,
  since a UUID arriving as JSON is a string either way.

Everything else — the names, the argument order, the failure modes, the wire
format — is the same on both sides.
"""

from __future__ import annotations

import secrets
import time
import uuid

_MILLISECOND_BITS = 48


def create_uuid() -> uuid.UUID:
    """Mint a UUIDv7: a 48-bit big-endian millisecond timestamp followed by 74
    random bits, with the version and variant nibbles set per RFC 9562.

    IDs are minted from v7 rather than v4 so that the bytes a database stores
    sort chronologically, even though :func:`e2b_id.encode_id` deliberately
    hides that order in the string it produces.

    ``uuid.uuid7`` covers this from Python 3.14 on, but the floor here is 3.10.

    :return: the UUID.
    """
    ms = time.time_ns() // 1_000_000
    value = ms << (128 - _MILLISECOND_BITS)
    value |= secrets.randbits(128 - _MILLISECOND_BITS)

    # Version 7 in the high nibble of byte 6, variant 10 in the top two bits of
    # byte 8. `uuid.UUID(int=…, version=7)` would do this, but only from 3.14.
    value &= ~(0xF << 76)
    value |= 0x7 << 76
    value &= ~(0b11 << 62)
    value |= 0b10 << 62

    return uuid.UUID(int=value)
