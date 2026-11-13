"""The TypeID codec: 16 bytes as 26 lowercase Crockford base32 characters.

The 128-bit value is written in base 32, most significant digit first, with the
Crockford alphabet (``0-9a-z`` minus ``i``, ``l``, ``o`` and ``u``), left-padded
to 26 digits. 26 digits carry 130 bits, so the leading digit holds the top three
bits of the value under two bits that are always zero: every encoding starts
with a character from ``0`` to ``7``.

This is the encoding of the TypeID specification and of
``github.com/sumup/typeid``, which is what E2B's Go services use
(``packages/shared/pkg/id`` in e2b-dev/infra). Agreeing with it is the whole
requirement: an ID minted here must decode there to the same UUID, and the
other way round. The Go suite's vectors are pinned in ``tests/vectors.py``.

The digits are the bits in order and the alphabet is in ASCII order, so the
string sorts the way the bytes do. A UUIDv7 leads with its 48-bit millisecond
timestamp, and so does its ID: IDs minted together share a long prefix, and
lexical order is mint order to the millisecond. That is what makes a TypeID
k-sortable — and why the front of an ID is the least distinctive part to read;
look at the tail.

Reading one in any language takes the alphabet and arithmetic::

    ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

    def encode(b: bytes) -> str:
        n = int.from_bytes(b, "big")
        return "".join(ALPHABET[(n >> (5 * i)) & 31] for i in range(25, -1, -1))

    def decode(s: str) -> bytes:
        n = 0
        for c in s:
            n = n * 32 + ALPHABET.index(c)
        return n.to_bytes(16, "big")

This module does it with ``base64.b32encode`` instead: four zero bytes in front
make 20 bytes, which is 32 RFC 4648 digits with no padding, of which the first
six are zero and the rest are the 26 wanted — then a character translation from
the RFC 4648 alphabet to Crockford's. The tests check that against the arithmetic
above.

Because 128 is not a multiple of 5, a leading digit of 8 or more spells a value
no 16 bytes can hold. A decoder that masked those bits away would map four
strings to every value; :func:`decode_bytes` accepts only the one
:func:`encode_bytes` produces and rejects the other three as ``overflow``, which
is also what the Go side does.
"""

from __future__ import annotations

import base64

from typing import Optional, Tuple

from .errors import InvalidIdException, InvalidIdReason

#: Crockford base32, lowercased: the digits, then the letters with ``i``, ``l``,
#: ``o`` and ``u`` left out so nothing reads as ``1`` or ``0``. The index of a
#: character is its digit value, and the characters are in ASCII order, which is
#: what makes encodings sort like the bytes they carry.
ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

#: The number of bytes every encoded value carries: a UUID's worth.
DECODED_LENGTH = 16

#: ``ceil(128 / 5)``: the digits needed for 16 bytes. Every encoding is exactly
#: this wide; there is no padding to add or strip.
ENCODED_LENGTH = 26

#: ``26 * 5 - 128``: the bits the width has spare. They are the two most
#: significant bits of the leading digit, and they are always zero.
SLACK_BITS = ENCODED_LENGTH * 5 - DECODED_LENGTH * 8

#: The largest digit value the leading character may hold: the three bits under
#: the slack, so ``7``. Anything above it spells a 129- or 130-bit value.
MAX_LEADING_DIGIT = (1 << (5 - SLACK_BITS)) - 1

# Character to digit value. Membership in this map is the alphabet check, and
# case is part of it: uppercase is simply not in it.
_VALUES = {character: value for value, character in enumerate(ALPHABET)}

# What b32encode emits, in the order of its digit values, so a translation
# table maps it onto the Crockford alphabet digit for digit.
_RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
_TO_CROCKFORD = str.maketrans(_RFC4648, ALPHABET)
_FROM_CROCKFORD = str.maketrans(ALPHABET, _RFC4648)

# Four zero bytes in front of the 16 make 20, which b32encode turns into 32
# digits with no padding. The first 6 digits are the 30 leading zero bits, and
# the 7th starts with the other 2 — the slack bits — so it is 0 to 7.
_FRONT_PAD = bytes(4)
_FRONT_PAD_DIGITS = len(_FRONT_PAD) * 8 // 5


def encode_bytes(raw: bytes) -> str:
    """Encode 16 bytes as 26 lowercase Crockford base32 characters, most
    significant first.

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

    digits = base64.b32encode(_FRONT_PAD + raw).decode()[_FRONT_PAD_DIGITS:]
    return digits.translate(_TO_CROCKFORD)


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
    # only the translated string below. Case is part of it: uppercase is simply
    # not in the alphabet, and accepting it would give every value millions of
    # spellings.
    for index, character in enumerate(encoded):
        if character not in _VALUES:
            return ("alphabet", index)

    # The slack bits are checked before decoding because b32decode will not
    # check them: it would hand back 20 bytes whose first four are not all zero,
    # and slicing them off would map all four spellings of a value to the same
    # 16 bytes. The difference is only visible here.
    if _VALUES[encoded[0]] > MAX_LEADING_DIGIT:
        return ("overflow", 0)

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
            f'one of the lowercase Crockford base32 characters "{ALPHABET}".',
        )
    return InvalidIdException(
        "overflow",
        f'"{encoded}" starts with {encoded[index]!r}, which spells a value above '
        f"{DECODED_LENGTH * 8} bits: the first character must be "
        f'"{ALPHABET[0]}" to "{ALPHABET[MAX_LEADING_DIGIT]}".',
    )


def decode_bytes(encoded: str) -> bytes:
    """Decode what :func:`encode_bytes` produced, and only that: 26
    characters, lowercase Crockford base32, with a leading character from
    ``0`` to ``7``.

    :param encoded: the 26-character encoding.
    :return: the 16 bytes it carries.
    :raises InvalidIdException: if ``encoded`` is the wrong length, holds a
        character outside the lowercase alphabet, or leads with a character
        above ``7``.
    """
    fault = fault_in_encoded(encoded)
    if fault is not None:
        raise invalid_encoding(encoded, fault)

    digits = _RFC4648[0] * _FRONT_PAD_DIGITS + encoded.translate(_FROM_CROCKFORD)
    return base64.b32decode(digits)[len(_FRONT_PAD) :]
