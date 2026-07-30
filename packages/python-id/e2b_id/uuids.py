"""Parsing and minting the UUIDs that IDs are made from — both mirroring
``github.com/google/uuid``, which is what E2B's Go services parse and mint
UUIDs with, so that a UUID string Go accepts is one this package accepts, and
the UUIDs minted here have the shape of the ones minted there.

UUIDs cross this package's boundary as :class:`uuid.UUID`, and the conversion to
and from bytes is the standard library's (``u.bytes`` and ``uuid.UUID(bytes=…)``)
rather than something this package wraps.

This is where the two surfaces diverge, and it is all downstream of one fact:
JavaScript has no UUID type, so ``@e2b/id`` moves UUIDs as hex strings where
this package moves :class:`uuid.UUID` objects. Concretely:

- ``@e2b/id`` exports ``uuidToBytes``/``bytesToUuid``; there is no equivalent
  here, because the standard library already is the equivalent.
- :func:`create_uuid` returns a :class:`uuid.UUID`; ``createUuid`` returns a
  string.
- :func:`e2b_id.decode_id` returns a :class:`uuid.UUID` and
  :attr:`e2b_id.ParsedId.uuid` is one, where ``decodeId`` and ``ParsedId.uuid``
  are strings — so a round trip is string-to-string in JS but not in Python.
- :func:`e2b_id.encode_id` accepts either a :class:`uuid.UUID` or a string,
  since a UUID arriving as JSON is a string either way.

Everything else — the names, the argument order, the failure modes, the wire
format, the strings accepted — is the same on both sides, with one difference
underneath :func:`create_uuid`: its 12-bit sequence is the clock's
sub-millisecond bits here, as in Go, and a per-millisecond counter in
JavaScript, whose clock has no such bits. The ordering guarantee is the same.
"""

from __future__ import annotations

import re
import secrets
import threading
import time
import uuid
from typing import Optional, Tuple

# The hyphenated 8-4-4-4-12 form and 32 bare hex digits, in either case.
_HYPHENATED = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\Z",
    re.IGNORECASE,
)
_BARE = re.compile(r"[0-9a-f]{32}\Z", re.IGNORECASE)

# The prefix of the URN form, matched case-insensitively like Go does.
_URN_PREFIX = "urn:uuid:"


def hex_digits_of(value: str) -> Optional[str]:
    """The 32 hex digits of a UUID string, or ``None`` if it is not one.

    Exactly the four spellings ``google/uuid``'s ``Parse`` takes, chosen by
    length as it does: hyphenated, ``urn:uuid:``-prefixed, braced, and bare.
    Nothing is checked about the version or variant bits, as nothing is there —
    a value that is 128 bits but not an RFC 9562 UUID still parses, and encodes.

    Held to those four on purpose: :class:`uuid.UUID` itself would also take
    hyphens anywhere and a bare ``uuid:`` prefix, which Go would not, and the
    point of this function is that both sides agree on what is a UUID.

    Go does not look at the braces themselves: it drops the first character and
    never reads the last, so ``[…]`` and ``x…y`` parse there. That is an
    oversight rather than a contract, and it is not mirrored — the braces have
    to be braces here.
    """
    length = len(value)
    if length == 36:
        return value.replace("-", "") if _HYPHENATED.match(value) else None
    if length == 36 + len(_URN_PREFIX):
        if value[: len(_URN_PREFIX)].lower() != _URN_PREFIX:
            return None
        return hex_digits_of(value[len(_URN_PREFIX) :])
    if length == 36 + 2:
        if value[0] != "{" or value[-1] != "}":
            return None
        return hex_digits_of(value[1:-1])
    if length == 32:
        return value if _BARE.match(value) else None
    return None


_MILLISECOND_BITS = 48
_SEQUENCE_BITS = 12
_SEQUENCE_MASK = (1 << _SEQUENCE_BITS) - 1
_NANOS_PER_MILLI = 1_000_000

# The last (timestamp << 12 | sequence) handed out, so the next is always
# greater: ``google/uuid`` keeps the same number behind a mutex. Module state,
# so it is per process, like Go's.
_time_lock = threading.Lock()
_last_v7_time = -1


def _next_v7_time() -> Tuple[int, int]:
    """The timestamp and sequence for the next UUIDv7, strictly greater than
    the previous pair even if the clock stalls or steps back.

    ``google/uuid``'s ``getV7Time``, line for line: the sequence is the
    sub-millisecond part of the clock in units of 256 nanoseconds (0 to 3906),
    and when that fails to move past the last value the pair is bumped by one
    instead, carrying into the millisecond on overflow.
    """
    global _last_v7_time
    with _time_lock:
        nano = time.time_ns()
        ms = nano // _NANOS_PER_MILLI
        sequence = (nano - ms * _NANOS_PER_MILLI) >> 8
        now = (ms << _SEQUENCE_BITS) + sequence
        if now <= _last_v7_time:
            now = _last_v7_time + 1
            ms = now >> _SEQUENCE_BITS
            sequence = now & _SEQUENCE_MASK
        _last_v7_time = now
        return ms, sequence


def create_uuid() -> uuid.UUID:
    """Mint a UUIDv7 the way ``google/uuid``'s ``NewV7`` does: a 48-bit
    big-endian millisecond timestamp, the version nibble, a 12-bit sequence
    that makes every UUID minted by this process strictly greater than the one
    before, the variant bits, and 62 random bits.

    IDs are minted from v7 rather than v4 so that the bytes a database stores
    sort chronologically — and, since :func:`e2b_id.encode_id` keeps the bits
    in order, so do the IDs, down to the order of two calls in the same
    millisecond. The Go side mints project and workspace UUIDs as v4; the codec
    does not care either way.

    ``uuid.uuid7`` covers the layout from Python 3.14 on, but the floor here is
    3.10, and its sequence is a counter rather than Go's clock bits.

    :return: the UUID.
    """
    ms, sequence = _next_v7_time()

    value = (ms & ((1 << _MILLISECOND_BITS) - 1)) << (128 - _MILLISECOND_BITS)
    value |= 0x7 << 76  # version 7
    value |= sequence << 64  # rand_a: the sequence
    value |= 0b10 << 62  # variant 10
    value |= secrets.randbits(62)  # rand_b

    return uuid.UUID(int=value)
