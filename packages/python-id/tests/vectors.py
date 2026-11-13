"""The shared test material: golden encodings, and a deterministic corpus.

``packages/js-id/tests/vectors.ts`` is the same file in TypeScript, value for
value — the same goldens, the same LCG, the same corpus in the same order. That
is what keeps the two implementations from drifting: both check the same inputs
against the same fixed outputs and against their own independent reference
encoder, and both pin :data:`CORPUS_DIGEST`, which no corpus or codec change can
survive on one side alone.
"""

from __future__ import annotations

import hashlib
from typing import Callable, List, Optional, Tuple

from e2b_id.codec import ALPHABET, ENCODED_LENGTH, SLACK_BITS
from e2b_id.ids import IdKind

# UUIDs and the encodings they must produce. The first four are copied from the
# Go suite (packages/shared/pkg/id/object_test.go in e2b-dev/infra), so they are
# the compatibility contract with the services rather than a record of this
# package; the rest were computed with the arithmetic snippet in codec.py.
# Change the alphabet, the width or the bit order and they stop matching.
#
# The five v7s were minted 37ms apart, so note what the encoding keeps: they
# share "01kyjhkf" at the front, which is the common timestamp showing through,
# and differ from there.
GOLDEN: List[Tuple[str, str]] = [
    # From the Go suite: a v4, the team UUID, a v7 secret, and the "legacy body"
    # test — a string in the old rotated format that happens to be a well-formed
    # TypeID too, which Go pins as reading to this UUID and nothing else.
    ("f47ac10b-58cc-4372-a567-0e02b2c3d479", "7mfb0gpp6c8dsaasre0asc7n3s"),
    ("550e8400-e29b-41d4-a716-446655440000", "2n1t201rmv87aae5j4csam8000"),
    ("019fa519-bf79-724d-8811-a2bfda9755fa", "01kyjhkfvse96rg4d2qzd9enft"),
    ("df8aa05e-b25e-7932-a6aa-33a2cddc3eef", "6zhag5xcjyf4sadahkmb6xrfqf"),
    # v7, minted 37ms after the one above and after each other.
    ("019fa519-bf9f-762a-a916-431479cc7171", "01kyjhkfwzernaj5j32hwwrwbh"),
    ("019fa519-bfc5-784d-9386-a5d7a93a692a", "01kyjhkfy5f16s71n5tymkmt9a"),
    ("019fa519-bfeb-79f2-aa2a-0addf5b9c0d9", "01kyjhkfzbf7samagavqtvkg6s"),
    ("019fa519-c011-7c8e-a039-cb3ba8ca8c16", "01kyjhkg0hfj7a0eeb7emcn30p"),
    # v3 and v5 of "e2b.dev" in the DNS namespace: the only versions that are
    # deterministic, and so the only ones that can be pinned by name.
    ("a3692b74-8ded-3329-af53-cc23b4d7dc27", "53d4nq93fd6cmtymyc4etdfq17"),
    ("fbe1337a-dac0-53d8-805c-905bca106f3e", "7vw4sqnpp0afc80q4gbf510vsy"),
    # The extremes: the leading digit tops out at 7 because it holds only three
    # bits of the value, and the lowest bit lands in the last character.
    ("00000000-0000-0000-0000-000000000000", "00000000000000000000000000"),
    ("00000000-0000-0000-0000-000000000001", "00000000000000000000000001"),
    ("80000000-0000-0000-0000-000000000000", "40000000000000000000000000"),
    ("ffffffff-ffff-ffff-ffff-ffffffffffff", "7zzzzzzzzzzzzzzzzzzzzzzzzz"),
    # Not UUIDs at all: two IPv6 addresses, which are the same 16 bytes and so
    # encode in the same column. Nothing in the codec reads version bits, and
    # these have none to read.
    ("26064700-4700-0000-0000-000000001111", "160s3g0hr0000000000000048h"),
    ("20010db8-85a3-0000-0000-8a2e03707334", "10046vh1d30000004a5r1q0wsm"),
]

# The same contract for the prefixed form, one per kind. The project, workspace
# and secret IDs are the Go suite's own, prefix and all.
GOLDEN_IDS: List[Tuple[IdKind, str, str]] = [
    (
        "project",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "prj_7mfb0gpp6c8dsaasre0asc7n3s",
    ),
    (
        "workspace",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "wrk_7mfb0gpp6c8dsaasre0asc7n3s",
    ),
    (
        "secret",
        "019fa519-bf79-724d-8811-a2bfda9755fa",
        "sec_01kyjhkfvse96rg4d2qzd9enft",
    ),
    (
        "volume",
        "019fa519-bfc5-784d-9386-a5d7a93a692a",
        "vol_01kyjhkfy5f16s71n5tymkmt9a",
    ),
    (
        "sandbox",
        "019fa519-bfeb-79f2-aa2a-0addf5b9c0d9",
        "sbx_01kyjhkfzbf7samagavqtvkg6s",
    ),
    (
        "user",
        "019fa519-c011-7c8e-a039-cb3ba8ca8c16",
        "usr_01kyjhkg0hfj7a0eeb7emcn30p",
    ),
    (
        "group",
        "550e8400-e29b-41d4-a716-446655440000",
        "grp_2n1t201rmv87aae5j4csam8000",
    ),
]

# sha256 of every encoding in `corpus()`, newline-joined, in order. The same
# constant appears in vectors.ts; if the two implementations ever disagree
# about the corpus or the format, one of them fails here.
CORPUS_DIGEST = "e58522dfc30f44687edca477cc58f37015d7c9e1c46311a354654db07b2f6bdc"

MASK_64 = (1 << 64) - 1
MASK_128 = (1 << 128) - 1


class Lcg:
    """A 64-bit linear congruential generator, so that the random half of the
    corpus is reproducible and identical in every implementation. The multiplier
    and increment are PCG's; the output byte is the top one, since an LCG's low
    bits are the weak ones.
    """

    def __init__(self, seed: int) -> None:
        self.state = seed & MASK_64

    def byte(self) -> int:
        self.state = (self.state * 6364136223846793005 + 1442695040888963407) & MASK_64
        return (self.state >> 56) & 0xFF

    def bytes(self, count: int) -> bytearray:
        return bytearray(self.byte() for _ in range(count))


def v4(source: Lcg) -> bytes:
    """16 bytes with a v4's version and variant nibbles."""
    raw = source.bytes(16)
    raw[6] = (raw[6] & 0x0F) | 0x40
    raw[8] = (raw[8] & 0x3F) | 0x80
    return bytes(raw)


def v7(source: Lcg, ms: Optional[int] = None) -> bytes:
    """16 bytes shaped like a v7: a 48-bit millisecond timestamp somewhere
    between 2020 and 2089, then the version and variant nibbles.
    """
    # Exactly 16 bytes are drawn either way, so the corpus does not shift when a
    # caller pins the timestamp.
    raw = source.bytes(16)
    at = (
        ms
        if ms is not None
        else 1577836800000 + int.from_bytes(raw[:6], "big") % (1 << 41)
    )
    for i in range(6):
        raw[i] = (at >> (8 * (5 - i))) & 0xFF
    raw[6] = (raw[6] & 0x0F) | 0x70
    raw[8] = (raw[8] & 0x3F) | 0x80
    return bytes(raw)


def bytes_from(value: int) -> bytes:
    return (value & MASK_128).to_bytes(16, "big")


def corpus() -> List[bytes]:
    """The shared input: the extremes, the smallest values, every power of two
    either side — a digit boundary falls every 5 bits and that is where a packing
    mistake shows — the goldens, and a reproducible random tail of v4s, v7s and
    values that are neither.
    """
    values = [bytes_from(0), bytes_from(MASK_128)]

    for value in range(1, 8):
        values.append(bytes_from(value))

    for bit in range(1, 128):
        power = 1 << bit
        for delta in (-1, 0, 1):
            values.append(bytes_from(power + delta))

    for hex_uuid, _ in GOLDEN:
        values.append(bytes_from(int(hex_uuid.replace("-", ""), 16)))

    random = Lcg(1)
    for _ in range(300):
        values.append(v4(random))
        values.append(v7(random))
        values.append(bytes(random.bytes(16)))

    return values


def ref_encode(raw: bytes) -> str:
    """An independent implementation of the format, stated as arithmetic rather
    than as a base64 call: the 128-bit value written in 26 base32 digits, most
    significant first. ``encode_bytes`` is checked against this rather than
    against itself, so a slip in the padding or the translation table would
    show up.
    """
    value = int.from_bytes(raw, "big")

    digits = []
    for _ in range(ENCODED_LENGTH):
        digits.append(ALPHABET[value & 31])
        value >>= 5

    return "".join(reversed(digits))


def ref_decode(encoded: str) -> bytes:
    """The permissive counterpart to :func:`ref_encode`: unpack 26 digits into
    130 bits and keep the low 128. It does not look at the slack bits, which is
    the point — it is what a decoder that forgets the leading-digit rule does,
    so the tests can show that all four spellings of a value reach it.
    """
    value = 0
    for character in encoded:
        value = (value << 5) | ALPHABET.index(character)
    return bytes_from(value & MASK_128)


#: The slack bits, as they sit in the leading digit: the high ``SLACK_BITS`` of
#: its five. OR-ing any nonzero multiple of this into the first digit's value
#: gives one of the three overflowing spellings.
SLACK_STEP = 1 << (5 - SLACK_BITS)


def corpus_digest(encode: Callable[[bytes], str]) -> str:
    """The digest :data:`CORPUS_DIGEST` pins."""
    joined = "\n".join(encode(raw) for raw in corpus())
    return hashlib.sha256(joined.encode()).hexdigest()
