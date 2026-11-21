import uuid as uuidlib

import pytest
from vectors import (
    CORPUS_DIGEST,
    GOLDEN,
    SLACK_STEP,
    Lcg,
    bytes_from,
    corpus,
    corpus_digest,
    ref_decode,
    ref_encode,
    v7,
)

from e2b_id import InvalidIdException
from e2b_id.codec import (
    ALPHABET,
    DECODED_LENGTH,
    ENCODED_LENGTH,
    MAX_LEADING_DIGIT,
    SLACK_BITS,
    decode_bytes,
    encode_bytes,
)


def test_the_format_is_these_exact_numbers():
    # Pinned as literals, not as their own definitions: asserting
    # `SLACK_BITS == ENCODED_LENGTH * 5 - DECODED_LENGTH * 8` restates the line
    # that computes it and so can never fail. These numbers ARE the format;
    # every ID ever minted depends on them, so changing one must break a test.
    # The same literals are pinned in js-id's codec.test.ts.
    assert ALPHABET == "0123456789abcdefghjkmnpqrstvwxyz"
    assert DECODED_LENGTH == 16
    assert ENCODED_LENGTH == 26
    assert SLACK_BITS == 2
    assert MAX_LEADING_DIGIT == 7


def test_and_those_numbers_are_the_ones_the_width_forces():
    # The relations that make those the right numbers: 25 digits cannot hold 128
    # bits, 26 hold 130, and the slack is the difference. Unlike the pins above
    # these are derivations, so they are stated against the arithmetic.
    assert ENCODED_LENGTH * 5 >= DECODED_LENGTH * 8
    assert (ENCODED_LENGTH - 1) * 5 < DECODED_LENGTH * 8
    assert SLACK_BITS == ENCODED_LENGTH * 5 - DECODED_LENGTH * 8
    assert MAX_LEADING_DIGIT == (1 << (5 - SLACK_BITS)) - 1
    assert SLACK_STEP == MAX_LEADING_DIGIT + 1
    assert len(ALPHABET) == 32
    assert len(set(ALPHABET)) == 32
    # Crockford: no i, l, o or u, so nothing reads as a 1 or a 0.
    assert not set("ilou") & set(ALPHABET)
    # In ASCII order, which is what lets encoded order follow byte order.
    assert "".join(sorted(ALPHABET)) == ALPHABET


@pytest.mark.parametrize("hex_uuid, encoded", GOLDEN)
def test_golden_encodings(hex_uuid: str, encoded: str):
    raw = uuidlib.UUID(hex_uuid).bytes
    assert encode_bytes(raw) == encoded
    assert decode_bytes(encoded) == raw


def test_the_string_is_the_bits_in_order():
    # The claim of the format: the string is the value's bits in 5-bit groups,
    # most significant first. Checked against ref_encode, which computes it a
    # different way.
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


@pytest.mark.parametrize("value", [1, 2, 7, 8, 31])
def test_the_smallest_values_are_one_character_from_zero_at_the_end(value: int):
    # The 31 smallest nonzero values fit in the last digit, so they are one
    # character from the encoding of zero; 32 is the first to spill into the
    # next one. That pins where the low bits live and that no shift happened.
    raw = bytes_from(value)
    want = ALPHABET[0] * (ENCODED_LENGTH - 1) + ALPHABET[value]

    assert encode_bytes(raw) == want
    assert decode_bytes(want) == raw


def test_the_top_bit_is_the_leading_digit():
    # Bit 127 lands in the first digit, under the two slack bits: it is the
    # leading digit's value 4, so the largest leading digit is 7.
    assert encode_bytes(bytes_from(1 << 127)) == ALPHABET[4] + ALPHABET[0] * (
        ENCODED_LENGTH - 1
    )
    assert encode_bytes(bytes_from((1 << 128) - 1))[0] == ALPHABET[MAX_LEADING_DIGIT]


def test_three_of_the_four_spellings_of_every_value_are_rejected():
    # The cost of 128 not dividing by 5. Every value has exactly four strings a
    # permissive decoder maps to it, differing only in the two high bits of the
    # leading digit. Exactly one — the one with those bits zero — is accepted.
    for raw in corpus()[:200]:
        encoded = encode_bytes(raw)
        digit = ALPHABET.index(encoded[0])
        assert digit <= MAX_LEADING_DIGIT, encoded

        accepted = 0
        for slack in range(1 << SLACK_BITS):
            alternative = ALPHABET[digit | (slack * SLACK_STEP)] + encoded[1:]

            # This is what makes the check necessary rather than incidental: a
            # decoder that keeps the low 128 bits maps all four spellings to the
            # same 16 bytes and reports nothing. Checked against ref_decode,
            # which unpacks without consulting the leading digit at all.
            assert ref_decode(alternative) == raw, alternative

            if slack == 0:
                assert decode_bytes(alternative) == raw
                accepted += 1
                continue
            with pytest.raises(InvalidIdException, match="above 128 bits"):
                decode_bytes(alternative)

        assert accepted == 1, encoded


def test_only_0_to_7_appear_first():
    # The same fact from the outside: only 8 of the 32 characters can ever
    # appear first, and over enough values every one of them does.
    allowed = set(ALPHABET[: MAX_LEADING_DIGIT + 1])
    assert allowed == set("01234567")

    seen = set()
    for raw in corpus():
        digit = encode_bytes(raw)[0]
        assert digit in allowed, f"{raw.hex()} starts with {digit!r}"
        seen.add(digit)
    assert seen == allowed


_VALID = encode_bytes(uuidlib.UUID("019fa41f-41cc-761e-8868-daa906581007").bytes)
# The first characters are digits, which have no upper case, so the one to
# raise is the first letter.
_FIRST_LETTER = next(i for i, c in enumerate(_VALID) if c.isalpha())


@pytest.mark.parametrize(
    "reason, encoded",
    [
        ("nothing at all", ""),
        ("one character short", _VALID[:-1]),
        ("one character long", _VALID + "0"),
        ("base32 padding", _VALID[:-1] + "="),
        # Nothing here ever emits uppercase, so accepting it would give every
        # value millions of spellings. Go rejects it too.
        ("uppercase", _VALID.upper()),
        (
            "a single uppercase letter",
            _VALID[:_FIRST_LETTER]
            + _VALID[_FIRST_LETTER].upper()
            + _VALID[_FIRST_LETTER + 1 :],
        ),
        # The four letters Crockford leaves out. Go's "bad alphabet" case is "i".
        ('"i", which is not in the alphabet', _VALID[:-1] + "i"),
        ('"l", which is not in the alphabet', _VALID[:-1] + "l"),
        ('"o", which is not in the alphabet', _VALID[:-1] + "o"),
        ('"u", which is not in the alphabet', _VALID[:-1] + "u"),
        ('"-", which is not a digit', "-" + _VALID[1:]),
        ("a non-ascii character", _VALID[:-1] + "é"),
        ("whitespace", " " + _VALID[1:]),
        ('a leading "8"', "8" + _VALID[1:]),
        ('a leading "z"', "z" + _VALID[1:]),
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
    assert decode_bytes("0" * ENCODED_LENGTH) == bytes(16)
    largest = bytes_from((1 << 128) - 1)
    assert decode_bytes(encode_bytes(largest)) == largest


def test_the_timestamp_reads_out_from_the_front():
    # Two v7s minted in the same millisecond share their first 52 bits
    # (timestamp plus version nibble), which is their first 10 digits. The
    # encoding keeps them where they are, so the fronts match.
    source = Lcg(7)

    for _ in range(1000):
        a = v7(source)
        b = bytearray(v7(source))
        b[:7] = a[:7]  # same millisecond, same version nibble

        assert encode_bytes(a)[:10] == encode_bytes(bytes(b))[:10]


def test_ids_minted_together_share_a_prefix():
    # The same point as the user sees it: a batch minted together shares a long
    # prefix, so the tail is the part to read.
    source = Lcg(11)
    at = 1758000000000

    fronts = {encode_bytes(v7(source, at + i))[:8] for i in range(200)}

    # 200 consecutive milliseconds move only the last of the first 10 digits or
    # so; the first 8 are constant over the batch.
    assert len(fronts) == 1


def test_and_so_sort_order_survives():
    # What the user gets for that: encoded order is byte order, so a v7's
    # chronology survives into the string and an index on it sorts by time.
    source = Lcg(15)
    values = [v7(source) for _ in range(5000)]

    for previous, current in zip(values, values[1:]):
        low, high = sorted((previous, current))
        assert encode_bytes(low) < encode_bytes(high), low.hex()
