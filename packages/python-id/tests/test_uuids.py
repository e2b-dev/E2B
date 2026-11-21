"""The UUID half of the package on its own: what ``hex_digits_of`` takes, and
how ``create_uuid`` lays out a v7. ``test_ids.py`` reaches both only through
``encode_id`` and ``create_id``.

Every ``create_uuid`` test starts from fresh module state: the last timestamp
and sequence handed out are per process and never go backwards, so without the
reset a test's mocked clock would be measured against whatever an earlier test
left behind.
"""

import uuid as uuidlib
from typing import List

import pytest
from vectors import corpus

from e2b_id import InvalidIdException, create_uuid, encode_id
from e2b_id import uuids
from e2b_id.uuids import hex_digits_of

_UUID = "019fa519-bf79-724d-8811-a2bfda9755fa"
_BARE = _UUID.replace("-", "")


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch):
    """Fresh state and a settable clock, in nanoseconds."""
    monkeypatch.setattr(uuids, "_last_v7_time", -1)
    now = [0]
    monkeypatch.setattr(uuids.time, "time_ns", lambda: now[0])

    def set_ns(ns: int) -> None:
        now[0] = ns

    return set_ns


def _ms(ms: int, sub_ms_ns: int = 0) -> int:
    return ms * 1_000_000 + sub_ms_ns


def _timestamp_of(value: uuidlib.UUID) -> int:
    return int.from_bytes(value.bytes[:6], "big")


def _sequence_of(value: uuidlib.UUID) -> int:
    return int.from_bytes(value.bytes[6:8], "big") & 0xFFF


# hex_digits_of


def test_hex_digits_of_reads_every_hex_digit_in_either_case():
    assert (
        hex_digits_of("0123456789abcdefABCDEF0123456789")
        == "0123456789abcdefABCDEF0123456789"
    )


def test_hex_digits_of_agrees_with_the_standard_library_over_the_corpus():
    # uuid.UUID is the independent reference for the canonical and bare forms;
    # the stricter forms it would also accept are pinned below.
    for raw in corpus():
        canonical = str(uuidlib.UUID(bytes=raw))
        assert hex_digits_of(canonical) == raw.hex(), raw.hex()
        assert hex_digits_of(canonical.upper()) == raw.hex().upper(), raw.hex()
        assert hex_digits_of(raw.hex()) == raw.hex(), raw.hex()
        assert encode_id("project", canonical) == encode_id(
            "project", uuidlib.UUID(bytes=raw)
        )


# google/uuid's Parse dispatches on length, so each form is probed one
# character either side of its length and with one bad character inside it.
@pytest.mark.parametrize(
    "case, value",
    [
        ("hyphenated, one short", _UUID[:-1]),
        ("hyphenated, one long", _UUID + "0"),
        ("hyphenated, a non-hex digit", _UUID[:-1] + "g"),
        ("hyphenated, a hyphen where a digit goes", _UUID[:-1] + "-"),
        ("urn, one short", "urn:uuid:" + _UUID[:-1]),
        ("urn, one long", "urn:uuid:" + _UUID + "0"),
        ("urn, the wrong prefix", "urn:uid::" + _UUID),
        ("urn, a non-hex digit", "urn:uuid:" + _UUID[:-1] + "g"),
        ("braced, one short", "{" + _UUID[:-1] + "}"),
        ("braced, one long", "{" + _UUID + "0}"),
        ("braced, the wrong closing brace", "{" + _UUID + ")"),
        ("braced, a non-hex digit", "{" + _UUID[:-1] + "g}"),
        ("bare, one short", _BARE[:-1]),
        ("bare, one long", _BARE + "0"),
        ("bare, a non-hex digit", _BARE[:-1] + "g"),
        # uuid.UUID would take each of these; Go does not.
        ("hyphens anywhere", "019f-a519bf79724d8811a2bfda9755fa"),
        ("the bare uuid: prefix", "uuid:" + _UUID),
        ("a trailing newline", _UUID + "\n"),
    ],
)
def test_hex_digits_of_rejects(case: str, value: str):
    assert hex_digits_of(value) is None
    with pytest.raises(InvalidIdException) as caught:
        encode_id("project", value)
    assert caught.value.reason == "uuid"


# A UUID column read out of JSON can be anything; the answer still has to be
# an InvalidIdException with the uuid reason, as in @e2b/id.
@pytest.mark.parametrize("value", [None, 123, b"0" * 16, bytes(16), [], {}])
def test_encode_id_rejects_a_uuid_that_is_not_a_string(value):
    with pytest.raises(InvalidIdException) as caught:
        encode_id("project", value)
    assert caught.value.reason == "uuid"


# create_uuid


def test_every_uuid_is_a_v7_with_the_rfc_9562_variant():
    # The variant overwrites two random bits, so it takes many draws to be sure
    # no random value leaks through.
    for _ in range(2000):
        minted = create_uuid()
        assert minted.version == 7
        assert minted.variant == uuidlib.RFC_4122


# The 48-bit timestamp is shifted into place, so the values either side of
# 2^32 and the top of the range are the ones to pin.
@pytest.mark.parametrize(
    "ms", [0, 1, 0xFFFFFFFF, 0x100000000, 0x03C0A519BF79, 2**48 - 1]
)
def test_the_timestamp_is_written_big_endian_into_the_first_six_bytes(clock, ms):
    clock(_ms(ms))
    minted = create_uuid()
    assert _timestamp_of(minted) == ms
    assert _sequence_of(minted) == 0


# Random bits only fill rand_b: with a generator of all ones or all zeros the
# timestamp, version and sequence are unchanged and the variant byte is exactly
# 0xbf or 0x80.
@pytest.mark.parametrize(
    "bits, expected",
    [
        ((1 << 62) - 1, "03c0a519-bf79-7000-bfff-ffffffffffff"),
        (0, "03c0a519-bf79-7000-8000-000000000000"),
    ],
)
def test_random_bits_only_reach_rand_b(
    clock, monkeypatch: pytest.MonkeyPatch, bits: int, expected: str
):
    clock(_ms(0x03C0A519BF79))
    monkeypatch.setattr(uuids.secrets, "randbits", lambda k: bits & ((1 << k) - 1))
    assert str(create_uuid()) == expected


def test_a_stalled_clock_counts_up_and_a_new_millisecond_starts_over(clock):
    clock(_ms(1_000_000))
    sequences: List[int] = [_sequence_of(create_uuid()) for _ in range(3)]
    assert sequences == [0, 1, 2]

    clock(_ms(1_000_001))
    minted = create_uuid()
    assert _timestamp_of(minted) == 1_000_001
    assert _sequence_of(minted) == 0


def test_a_full_sequence_carries_into_the_next_millisecond(clock):
    # The clock's sub-millisecond bits start the sequence at 3906, its highest
    # value, so 189 stalled mints reach 4095 and the next carries.
    clock(_ms(1_000_000, 999_999))
    minted = [create_uuid() for _ in range(4096 - 3906)]
    assert [_sequence_of(m) for m in minted] == list(range(3906, 4096))

    carried = create_uuid()
    assert _timestamp_of(carried) == 1_000_001
    assert _sequence_of(carried) == 0

    # The clock still reads the old millisecond, which is now behind: the
    # carried one keeps counting rather than going back.
    assert _sequence_of(create_uuid()) == 1

    # Once the clock moves past the carried value, its own bits take over.
    clock(_ms(1_000_002, 256 * 7))
    assert _sequence_of(create_uuid()) == 7


def test_a_clock_that_steps_back_keeps_the_last_millisecond(clock):
    clock(_ms(1_000_000))
    before = create_uuid()
    clock(_ms(500_000))
    after = create_uuid()
    assert _timestamp_of(after) == 1_000_000
    assert _sequence_of(after) == _sequence_of(before) + 1
    assert after.int > before.int
