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

from e2b_id.codec import ALPHABET, ENCODED_LENGTH, ROTATION, SLACK_BITS
from e2b_id.ids import IdKind

# UUIDs and the encodings they must produce. These strings were computed with
# base64.b32encode rather than captured from this package, so they check the
# implementation rather than record it, and they are the compatibility contract:
# change the alphabet, the width or the rotation and they stop matching.
#
# The five v7s were minted 37ms apart, so note what the rotation did: they share
# "agp2kg" from index 10, which is the common timestamp showing through, and
# their fronts differ.
GOLDEN: List[Tuple[str, str]] = [
    # v7, minted 37ms apart.
    ("019fa519-bf79-724d-8811-a2bfda9755fa", "uk75vf2v7iagp2kgn7pfze3car"),
    ("019fa519-bf9f-762a-a916-431479cc7171", "imkhttdroeagp2kgn7t53cvkiw"),
    ("019fa519-bfc5-784d-9386-a5d7a93a692a", "uxl2sotjfiagp2kgn7yv4e3e4g"),
    ("019fa519-bfeb-79f2-aa2a-0addf5b9c0d9", "blo7looa3eagp2kgn75n47fkrk"),
    ("019fa519-c011-7c8e-a039-cb3ba8ca8c16", "zm52rsumcyagp2kgoacf6i5ibz"),
    # v3 and v5 of "e2b.dev" in the DNS namespace: the only versions that are
    # deterministic, and so the only ones that can be pinned by name.
    ("a3692b74-8ded-3329-af53-cc23b4d7dc27", "zqr3jv64e4unusw5en5uzstl2t"),
    ("fbe1337a-dac0-53d8-805c-905bca106f3e", "sbn4uedphy7pqtg6w2ybj5rac4"),
    # A real v4.
    ("f47ac10b-58cc-4372-a567-0e02b2c3d479", "byblfq6upe6r5mcc2yzrbxfjlh"),
    # The extremes, and the value whose only set bit is the lowest one: it lands
    # in the slack digit, which rotation has moved to index 9.
    ("00000000-0000-0000-0000-000000000000", "aaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ("00000000-0000-0000-0000-000000000001", "aaaaaaaaaeaaaaaaaaaaaaaaaa"),
    ("ffffffff-ffff-ffff-ffff-ffffffffffff", "77777777747777777777777777"),
    # Not UUIDs at all: two IPv6 addresses, which are the same 16 bytes and so
    # encode in the same column. Nothing in the codec reads version bits, and
    # these have none to read.
    ("26064700-4700-0000-0000-000000001111", "aaaaaaarceeydeoachaaaaaaaa"),
    ("20010db8-85a3-0000-0000-8a2e03707334", "rixag4dtgqeaaq3oefumaaaaaa"),
]

# The same contract for the prefixed form, one per kind.
GOLDEN_IDS: List[Tuple[IdKind, str, str]] = [
    (
        "project",
        "019fa519-bf79-724d-8811-a2bfda9755fa",
        "prj_uk75vf2v7iagp2kgn7pfze3car",
    ),
    (
        "workspace",
        "019fa519-bf9f-762a-a916-431479cc7171",
        "wrk_imkhttdroeagp2kgn7t53cvkiw",
    ),
    (
        "volume",
        "019fa519-bfc5-784d-9386-a5d7a93a692a",
        "vol_uxl2sotjfiagp2kgn7yv4e3e4g",
    ),
    (
        "sandbox",
        "019fa519-bfeb-79f2-aa2a-0addf5b9c0d9",
        "sbx_blo7looa3eagp2kgn75n47fkrk",
    ),
    (
        "user",
        "019fa519-c011-7c8e-a039-cb3ba8ca8c16",
        "usr_zm52rsumcyagp2kgoacf6i5ibz",
    ),
    (
        "group",
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "grp_byblfq6upe6r5mcc2yzrbxfjlh",
    ),
]

# sha256 of every encoding in `corpus()`, newline-joined, in order. The same
# constant appears in vectors.ts; if the two implementations ever disagree
# about the corpus or the format, one of them fails here.
CORPUS_DIGEST = "a83c455e0a4ffd39e51c69d832c544b6809bf836f6459e2a9797005dddc71ec0"

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
    than as bit shuffling: the 128-bit value, moved up by the two slack bits,
    written in 26 base32 digits, then rotated. ``encode_bytes`` is checked
    against this rather than against itself, so a change in what ``b32encode``
    packs would show up.
    """
    value = int.from_bytes(raw, "big") << SLACK_BITS

    digits = []
    for _ in range(ENCODED_LENGTH):
        digits.append(ALPHABET[value & 31])
        value >>= 5

    unrotated = "".join(reversed(digits))
    return unrotated[ROTATION:] + unrotated[:ROTATION]


def corpus_digest(encode: Callable[[bytes], str]) -> str:
    """The digest :data:`CORPUS_DIGEST` pins."""
    joined = "\n".join(encode(raw) for raw in corpus())
    return hashlib.sha256(joined.encode()).hexdigest()
