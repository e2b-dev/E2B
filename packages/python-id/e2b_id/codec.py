"""The rotated base32 codec: 16 bytes as 26 lowercase characters.

The 16 bytes are base32-encoded with the RFC 4648 section 6 alphabet
("A-Z2-7"), lowercased, unpadded: 26 characters. The string is then rotated
left by :data:`ROTATION`, so what was the first character is now the 11th.

Rotation is the whole trick. A UUIDv7 leads with a 48-bit big-endian
millisecond timestamp, so unrotated encodings of IDs minted together share a
long common prefix and the leading characters are nearly constant for months.
Rotating moves those characters inward: the string now leads with 10 characters
of random bits, the timestamp reads out from :data:`TIMESTAMP_INDEX`, and its
9.6 digits are followed by the remaining random bits.

Decoding undoes it by rotating left by the other 10. The two amounts differ, so
unlike a half-length rotation this one is not its own inverse; ``_rotate`` and
``_unrotate`` are separate functions and the tests hold them together.

The alphabet is exactly the one ``base64.b32encode`` uses, so this module needs
no tables of its own — only the rotation. That is also the whole of the interop
contract, and it is short enough to restate::

    import base64

    def encode(b: bytes) -> str:
        s = base64.b32encode(b).decode().rstrip("=").lower()
        return s[16:] + s[:16]

    def decode(s: str) -> bytes:
        s = s[10:] + s[:10]
        return base64.b32decode(s.upper() + "======")

26 base32 digits carry 130 bits and 16 bytes are 128, so the final digit of the
unrotated string holds 2 bits that are always zero. ``b32decode`` discards those
bits without looking, so every value has four spellings that decode to it.
:func:`decode_bytes` accepts only the one :func:`encode_bytes` produces and
rejects the other three. After rotation that digit sits at
:data:`SLACK_INDEX`, not at the end.
"""

from __future__ import annotations

import base64

from typing import Optional, Tuple

from .errors import InvalidIdException, InvalidIdReason

#: RFC 4648 section 6, lowercased: what ``base64.b32encode`` produces once
#: ``.lower()`` is applied. The index of a character is its digit value.
ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"

#: The number of bytes every encoded value carries: a UUID's worth.
DECODED_LENGTH = 16

#: ``ceil(128 / 5)``: the digits needed for 16 bytes. Every encoding is exactly
#: this wide; there is no padding to add or strip.
ENCODED_LENGTH = 26

#: How far :func:`encode_bytes` rotates the string left, chosen so a UUIDv7's
#: timestamp starts at :data:`TIMESTAMP_INDEX`: far enough in that the leading
#: characters are random, near enough the front that the timestamp begins in the
#: first half of the string. Decoding rotates left by the remainder.
#:
#: The timestamp's ~10 digits then run from index 10 to 19, so most of it in fact
#: lands in the second half — what the rotation buys is that none of it lands at
#: the *front*, which is the part people read, sort by and truncate.
ROTATION = 16

#: Where the unrotated string's first character lands: byte 0 of the value, and
#: so bit 0 of a UUIDv7's timestamp, reads out here.
TIMESTAMP_INDEX = ENCODED_LENGTH - ROTATION

#: ``26 * 5 - 128``: the always-zero bits in the final unrotated digit, and the
#: mask that selects them out of that digit's value.
SLACK_BITS = ENCODED_LENGTH * 5 - DECODED_LENGTH * 8
SLACK_MASK = (1 << SLACK_BITS) - 1

#: Where that digit lands after rotation: the character a decoder must check
#: for canonical form is inside the string, just before the timestamp, not at
#: the end.
SLACK_INDEX = TIMESTAMP_INDEX - 1

# Character to digit value. Membership in this map is the alphabet check, and
# case is part of it: uppercase is simply not in it.
_VALUES = {character: value for value, character in enumerate(ALPHABET)}


def _rotate(s: str) -> str:
    """Rotate a 26-character string left by :data:`ROTATION`."""
    return s[ROTATION:] + s[:ROTATION]


def _unrotate(s: str) -> str:
    """Rotate left by the remainder, which undoes :func:`_rotate`."""
    return s[ENCODED_LENGTH - ROTATION :] + s[: ENCODED_LENGTH - ROTATION]


def encode_bytes(raw: bytes) -> str:
    """Encode 16 bytes as 26 lowercase base32 characters, rotated so the
    leading bytes read out from the middle of the string.

    It cannot fail for any 16 bytes: nothing here reads a UUID's version or
    variant, so an arbitrary 128-bit value encodes just as well as a UUID.

    :param raw: exactly 16 bytes.
    :return: the 26-character encoding.
    :raises InvalidIdException: if ``raw`` is not 16 bytes long.
    """
    if len(raw) != DECODED_LENGTH:
        raise InvalidIdException(
            "length",
            f"Cannot encode {len(raw)} bytes: expected exactly {DECODED_LENGTH}.",
        )

    return _rotate(base64.b32encode(raw).decode().rstrip("=").lower())


def fault_in_encoded(encoded: str) -> Optional[Tuple[InvalidIdReason, int]]:
    """Why :func:`decode_bytes` would reject a string, or ``None`` if it would
    accept it.

    Reported without building an exception, so :func:`e2b_id.is_id` can answer a
    boolean without paying for a message and a traceback.

    :param encoded: the string to check.
    :return: the reason and the offending index, or ``None``.
    """
    if len(encoded) != ENCODED_LENGTH:
        return ("length", -1)

    # Membership is checked here rather than left to b32decode, which would see
    # only the upper-cased string below and so would accept uppercase input.
    # Accepting it would give every value millions of spellings.
    for index, character in enumerate(encoded):
        if character not in _VALUES:
            return ("alphabet", index)

    # The slack digit is checked before decoding because b32decode will not check
    # it at all: it drops the low SLACK_BITS of the final digit unread, so all
    # four spellings of a value decode identically and the difference is only
    # visible here. That digit is the last one of the unrotated string, which
    # rotation has moved to SLACK_INDEX.
    if _VALUES[encoded[SLACK_INDEX]] & SLACK_MASK:
        return ("canonical", SLACK_INDEX)

    return None


def invalid_encoding(
    encoded: str, fault: Tuple[InvalidIdReason, int]
) -> InvalidIdException:
    """Build the exception for a fault.

    Separate from :func:`fault_in_encoded` so the message — the expensive part —
    is only interpolated when something is about to be raised.
    """
    reason, index = fault
    if reason == "length":
        return InvalidIdException(
            "length",
            f'"{encoded}" is {len(encoded)} characters long: '
            f"expected exactly {ENCODED_LENGTH}.",
        )
    if reason == "alphabet":
        return InvalidIdException(
            "alphabet",
            f'"{encoded}" holds {encoded[index]!r} at index {index}, which is not '
            f'one of the lowercase base32 characters "{ALPHABET}".',
        )
    return InvalidIdException(
        "canonical",
        f'"{encoded}" is not the canonical spelling of its value: '
        f"{encoded[index]!r} at index {index} sets {SLACK_BITS} "
        f"bits no 128-bit value reaches.",
    )


def decode_bytes(encoded: str) -> bytes:
    """Decode what :func:`encode_bytes` produced, and only that: 26
    characters, lowercase RFC 4648 base32, rotated, with the two slack bits
    zero.

    :param encoded: the 26-character encoding.
    :return: the 16 bytes it carries.
    :raises InvalidIdException: if ``encoded`` is the wrong length, holds a
        character outside the lowercase alphabet, or is one of the three
        non-canonical spellings of its value.
    """
    fault = fault_in_encoded(encoded)
    if fault is not None:
        raise invalid_encoding(encoded, fault)

    return base64.b32decode(_unrotate(encoded).upper() + "=" * 6)
