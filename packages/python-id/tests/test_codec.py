import base64
import uuid as uuidlib

import pytest
from vectors import (
    CORPUS_DIGEST,
    GOLDEN,
    Lcg,
    bytes_from,
    corpus,
    corpus_digest,
    ref_encode,
    v7,
)

from e2b_id import InvalidIdException
from e2b_id.codec import (
    ALPHABET,
    DECODED_LENGTH,
    ENCODED_LENGTH,
    ROTATION,
    SLACK_BITS,
    SLACK_INDEX,
    SLACK_MASK,
    TIMESTAMP_INDEX,
    decode_bytes,
    encode_bytes,
)


def test_the_format_is_these_exact_numbers():
    # Pinned as literals, not as their own definitions: asserting
    # `TIMESTAMP_INDEX == ENCODED_LENGTH - ROTATION` restates the line that
    # computes it and so can never fail — it would stay green with ROTATION
    # changed to 20, which is a different wire format. These numbers ARE the
    # format; every ID ever minted depends on them, so changing one must break a
    # test. The same literals are pinned in js-id's codec.test.ts.
    assert ALPHABET == "abcdefghijklmnopqrstuvwxyz234567"
    assert DECODED_LENGTH == 16
    assert ENCODED_LENGTH == 26
    assert ROTATION == 16
    assert TIMESTAMP_INDEX == 10
    assert SLACK_INDEX == 9
    assert SLACK_BITS == 2
    assert SLACK_MASK == 3


def test_and_those_numbers_are_the_ones_the_width_forces():
    # The relations that make those the right numbers: 25 digits cannot hold 128
    # bits, 26 hold 130, and the slack is the difference. Unlike the pins above
    # these are derivations, so they are stated against the arithmetic.
    assert ENCODED_LENGTH * 5 >= DECODED_LENGTH * 8
    assert (ENCODED_LENGTH - 1) * 5 < DECODED_LENGTH * 8
    assert SLACK_BITS == ENCODED_LENGTH * 5 - DECODED_LENGTH * 8
    assert SLACK_MASK == (1 << SLACK_BITS) - 1
    assert TIMESTAMP_INDEX == ENCODED_LENGTH - ROTATION
    assert SLACK_INDEX == TIMESTAMP_INDEX - 1
    assert len(ALPHABET) == 32
    assert len(set(ALPHABET)) == 32
    # The front must be random, which needs the rotation past a v7's 10
    # non-random leading digits (48 timestamp bits plus 2 of the version nibble).
    assert ROTATION >= 14
    assert ROTATION < ENCODED_LENGTH  # not a full turn


@pytest.mark.parametrize("hex_uuid, encoded", GOLDEN)
def test_golden_encodings(hex_uuid: str, encoded: str):
    raw = uuidlib.UUID(hex_uuid).bytes
    assert encode_bytes(raw) == encoded
    assert decode_bytes(encoded) == raw


def test_the_string_is_the_bits_rotated():
    # The claim of the format: the string is the value's bits in 5-bit groups,
    # rotated. Checked against ref_encode, which computes it a different way.
    for raw in corpus():
        assert encode_bytes(raw) == ref_encode(raw), raw.hex()


def test_every_encoding_round_trips():
    for raw in corpus():
        encoded = encode_bytes(raw)
        assert len(encoded) == ENCODED_LENGTH, raw.hex()
        assert encoded == encoded.lower()
        assert decode_bytes(encoded) == raw


def test_the_corpus_is_the_one_js_id_checks():
    # The one constant both suites hold: same corpus, same format, same digest.
    assert corpus_digest(encode_bytes) == CORPUS_DIGEST


@pytest.mark.parametrize("value", range(1, 8))
def test_the_smallest_values_are_one_character_from_zero(value: int):
    # The seven smallest nonzero values fit entirely in the slack digit:
    # encoding shifts a value up by the two slack bits, so 1 through 7 become
    # digit values 4 through 28, always a multiple of 4 and so always canonical.
    # Seven strings differing from the encoding of zero in exactly one character
    # say where the low bits live, that the shift happened, and where the
    # rotation put it. Value 8 is the first to spill into a second digit.
    raw = bytes_from(value)
    want = (
        "a" * SLACK_INDEX
        + ALPHABET[value << SLACK_BITS]
        + "a" * (ENCODED_LENGTH - SLACK_INDEX - 1)
    )

    assert encode_bytes(raw) == want
    assert decode_bytes(want) == raw


def test_three_of_the_four_spellings_of_every_value_are_rejected():
    # The cost of 128 not dividing by 5. Every value has exactly four strings a
    # permissive base32 decoder maps to it, differing only in the slack digit,
    # which rotation has moved to SLACK_INDEX. Exactly one is canonical, and
    # b32decode reports nothing about the other three.
    for raw in corpus()[:200]:
        encoded = encode_bytes(raw)
        digit = ALPHABET.index(encoded[SLACK_INDEX])
        assert digit & SLACK_MASK == 0, encoded

        accepted = 0
        for slack in range(0, SLACK_MASK + 1):
            alternative = (
                encoded[:SLACK_INDEX]
                + ALPHABET[digit | slack]
                + encoded[SLACK_INDEX + 1 :]
            )

            # This is what makes the canonical check necessary rather than
            # incidental: a permissive decoder — including the six-line
            # b32decode snippet this package advertises — maps all four
            # spellings to the same 16 bytes and reports nothing. Unrotating by
            # hand (`s[10:] + s[:10]`, exactly the snippet) keeps this
            # independent of the module's own _unrotate.
            unrotated = (
                alternative[ENCODED_LENGTH - ROTATION :]
                + alternative[: ENCODED_LENGTH - ROTATION]
            )
            assert base64.b32decode(unrotated.upper() + "=" * 6) == raw, alternative

            if slack == 0:
                assert decode_bytes(alternative) == raw
                accepted += 1
                continue
            with pytest.raises(InvalidIdException, match="canonical"):
                decode_bytes(alternative)

        assert accepted == 1, encoded


def test_only_multiples_of_four_appear_in_the_slack_digit():
    # The same fact from the outside: only 8 of the 32 characters can ever
    # appear at SLACK_INDEX, and over enough values every one of them does.
    allowed = {ALPHABET[value] for value in range(0, 32, SLACK_MASK + 1)}

    seen = set()
    for raw in corpus():
        digit = encode_bytes(raw)[SLACK_INDEX]
        assert digit in allowed, f"{raw.hex()} has {digit!r} at index {SLACK_INDEX}"
        seen.add(digit)
    assert seen == allowed


_VALID = encode_bytes(uuidlib.UUID("019fa41f-41cc-761e-8868-daa906581007").bytes)
# The first character may be a digit, which has no upper case, so the one to
# raise is the first letter.
_FIRST_LETTER = next(i for i, c in enumerate(_VALID) if c.isalpha())


@pytest.mark.parametrize(
    "reason, encoded",
    [
        ("nothing at all", ""),
        ("one character short", _VALID[:-1]),
        ("one character long", _VALID + "a"),
        ("base32 padding", _VALID[:-1] + "="),
        # Nothing here ever emits uppercase, so accepting it would give every
        # value millions of spellings.
        ("uppercase", _VALID.upper()),
        (
            "a single uppercase letter",
            _VALID[:_FIRST_LETTER]
            + _VALID[_FIRST_LETTER].upper()
            + _VALID[_FIRST_LETTER + 1 :],
        ),
        ('"0", which is not in the alphabet', "0" + _VALID[1:]),
        ('"1", which is not in the alphabet', "1" + _VALID[1:]),
        ('"8", which is not in the alphabet', "8" + _VALID[1:]),
        ('"9", which is not in the alphabet', "9" + _VALID[1:]),
        ('"-", which is not a digit', "-" + _VALID[1:]),
        ("a non-ascii character", _VALID[:-1] + "é"),
        ("whitespace", " " + _VALID[1:]),
    ],
)
def test_decoding_rejects(reason: str, encoded: str):
    with pytest.raises(InvalidIdException):
        decode_bytes(encoded)


@pytest.mark.parametrize("length", [0, 15, 17, 32])
def test_encoding_rejects_anything_that_is_not_16_bytes(length: int):
    with pytest.raises(InvalidIdException):
        encode_bytes(bytes(length))


def test_but_not_the_extremes():
    # All zeros decodes to the zero value rather than failing.
    assert decode_bytes("a" * ENCODED_LENGTH) == bytes(16)
    largest = bytes_from((1 << 128) - 1)
    assert decode_bytes(encode_bytes(largest)) == largest


def test_the_timestamp_reads_out_from_the_middle():
    # Two v7s minted in the same millisecond share their first 52 bits
    # (timestamp plus version nibble), which is their first 10 digits; rotation
    # moves those to indices 10 through 19. So the insides must match and, over
    # enough samples, the fronts must not.
    source = Lcg(7)

    same_front = 0
    for _ in range(1000):
        a = v7(source)
        b = bytearray(v7(source))
        b[:7] = a[:7]  # same millisecond, same version nibble

        encoded_a, encoded_b = encode_bytes(a), encode_bytes(bytes(b))
        assert (
            encoded_a[TIMESTAMP_INDEX : TIMESTAMP_INDEX + 10]
            == encoded_b[TIMESTAMP_INDEX : TIMESTAMP_INDEX + 10]
        )
        if encoded_a[:4] == encoded_b[:4]:
            same_front += 1

    # The first 4 characters are 20 random bits; collisions are ~1e-6.
    assert same_front <= 2


def test_ids_minted_together_do_not_share_a_prefix():
    # The same point as the user sees it: a batch minted together would have
    # shared a long prefix unrotated, and must not now.
    source = Lcg(11)
    at = 1758000000000

    fronts = {encode_bytes(v7(source, at + i))[0] for i in range(200)}

    # 200 draws over 32 first characters: fewer than 10 distinct would be wildly
    # improbable for uniform bits.
    assert len(fronts) >= 10


def test_and_what_it_costs_sort_order_is_gone():
    # The trade, stated plainly so no one builds an index on these strings
    # expecting v7's chronology to survive: the front is random, so encoded
    # order and timestamp order are unrelated.
    source = Lcg(15)
    values = [v7(source) for _ in range(5000)]

    inversions = 0
    for previous, current in zip(values, values[1:]):
        low, high = sorted((previous, current))
        if encode_bytes(low) > encode_bytes(high):
            inversions += 1

    # Random fronts mean about half of all pairs invert.
    assert inversions > len(values) / 5
