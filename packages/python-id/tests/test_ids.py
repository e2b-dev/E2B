import re
import time
import uuid as uuidlib
from typing import List, cast

import pytest
from vectors import GOLDEN, GOLDEN_IDS, corpus

from e2b_id import uuids
from e2b_id.uuids import hex_digits_of

from e2b_id import (
    ID_LENGTH,
    ID_PREFIXES,
    IdKind,
    InvalidIdException,
    ParsedId,
    create_id,
    create_uuid,
    decode_id,
    encode_id,
    is_id,
    parse_id,
)
from e2b_id.codec import ALPHABET, ENCODED_LENGTH

KINDS: List[IdKind] = list(ID_PREFIXES)

_PROJECT_ID = GOLDEN_IDS[0][2]
_PROJECT_UUID = GOLDEN_IDS[0][1]


def test_every_kind_has_a_distinct_three_character_prefix():
    prefixes = list(ID_PREFIXES.values())
    assert len(set(prefixes)) == len(prefixes)
    for prefix in prefixes:
        assert re.fullmatch(r"[a-z]{3}", prefix)
    assert ID_LENGTH == 3 + 1 + ENCODED_LENGTH


def test_every_kind_is_covered_here():
    assert KINDS == [
        "project",
        "workspace",
        "secret",
        "volume",
        "sandbox",
        "user",
        "group",
    ]
    assert sorted(kind for kind, _, _ in GOLDEN_IDS) == sorted(KINDS)


@pytest.mark.parametrize("kind, hex_uuid, id", GOLDEN_IDS)
def test_golden_ids(kind: IdKind, hex_uuid: str, id: str):
    expected = uuidlib.UUID(hex_uuid)
    assert encode_id(kind, expected) == id
    assert encode_id(kind, hex_uuid) == id
    assert decode_id(kind, id) == expected
    assert parse_id(id) == ParsedId(kind=kind, uuid=expected)
    assert is_id(kind, id)


def test_every_id_is_id_length_characters_wide():
    for kind in KINDS:
        for hex_uuid, _ in GOLDEN:
            assert len(encode_id(kind, hex_uuid)) == ID_LENGTH


def test_every_value_round_trips_through_every_kind():
    for raw in corpus():
        expected = uuidlib.UUID(bytes=raw)
        for kind in KINDS:
            id = encode_id(kind, expected)
            assert id.startswith(ID_PREFIXES[kind] + "_"), id
            assert decode_id(kind, id) == expected, raw.hex()
            assert parse_id(id) == ParsedId(kind=kind, uuid=expected)


def test_uuids_are_accepted_in_either_case():
    assert encode_id("project", _PROJECT_UUID.upper()) == encode_id(
        "project", _PROJECT_UUID
    )


@pytest.mark.parametrize(
    "form, value",
    [
        ("hyphenated", "019fa519-bf79-724d-8811-a2bfda9755fa"),
        ("urn-prefixed", "urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa"),
        ("urn-prefixed in upper case", "URN:UUID:019FA519-BF79-724D-8811-A2BFDA9755FA"),
        ("braced", "{019fa519-bf79-724d-8811-a2bfda9755fa}"),
        ("bare", "019fa519bf79724d8811a2bfda9755fa"),
    ],
)
def test_a_uuid_in_any_of_gos_four_forms_is_accepted(form: str, value: str):
    # The four spellings google/uuid's Parse takes, so a UUID string the Go side
    # accepts is one this package accepts, and both encode it the same.
    assert encode_id("project", value) == "prj_01kyjhkfvse96rg4d2qzd9enft"
    assert (hex_digits_of(value) or "").lower() == "019fa519bf79724d8811a2bfda9755fa"


def test_a_non_rfc_value_still_parses():
    # Nothing reads the version or variant: Go does not, so a 128-bit value
    # that is not an RFC 9562 UUID still encodes, and to the same string.
    assert encode_id("project", "26064700-4700-0000-0000-000000001111") == encode_id(
        "project", "26064700470000000000000000001111"
    )


def test_create_id_produces_an_id_of_the_kind_asked_for():
    for kind in KINDS:
        id = create_id(kind)
        assert len(id) == ID_LENGTH
        assert is_id(kind, id)
        assert parse_id(id).kind == kind


def test_create_uuid_mints_v7s_that_carry_the_current_time():
    before = time.time_ns() // 1_000_000
    minted = create_uuid()
    after = time.time_ns() // 1_000_000

    assert minted.version == 7
    assert minted.variant == uuidlib.RFC_4122
    assert before <= int.from_bytes(minted.bytes[:6], "big") <= after


def test_create_uuid_does_not_repeat_itself():
    assert len({create_uuid() for _ in range(1000)}) == 1000


def test_uuids_minted_in_order_carry_timestamps_in_order():
    # The point of minting from v7: the bytes a database stores sort by time,
    # and so do the IDs made from them. Only to the millisecond — within one,
    # the rest of the UUID is random and nothing here adds a counter — so the
    # timestamp field is what is ordered.
    timestamps = [create_uuid().bytes[:6] for _ in range(1000)]
    assert sorted(timestamps) == timestamps


def test_and_so_do_the_ids_minted_from_them():
    fronts = [create_id("sandbox")[: 4 + 10] for _ in range(1000)]
    assert sorted(fronts) == fronts


def test_every_uuid_is_greater_than_the_one_before():
    # The first 8 bytes are the timestamp, the version and the sequence; the
    # sequence is what makes two calls in the same millisecond ordered, so the
    # whole UUID strictly increases call by call, not just its timestamp.
    minted = [create_uuid() for _ in range(5000)]
    for previous, current in zip(minted, minted[1:]):
        assert current.int > previous.int, (previous, current)


# The mocked clocks below are in 2100, past anything already handed out, and
# each test's clock is later than the previous test's: the state is per process
# and never goes backwards, so a mock in the past would just be another stalled
# clock.
def test_even_when_the_clock_stalls(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(uuids.time, "time_ns", lambda: 4102444800000 * 1_000_000)
    # The clock's sub-millisecond bits are zero, so the sequence starts at 0
    # and more than the 4096 it holds have to carry into the timestamp, which
    # Go's getV7Time does by adding one to the packed value.
    minted = [create_uuid() for _ in range(5000)]
    assert len(set(minted)) == len(minted)
    for previous, current in zip(minted, minted[1:]):
        assert current.int > previous.int
    assert {m.bytes[:6] for m in minted} == {
        (4102444800000).to_bytes(6, "big"),
        (4102444800001).to_bytes(6, "big"),
    }
    sequences = [int.from_bytes(m.bytes[6:8], "big") & 0xFFF for m in minted[:4096]]
    assert sequences == list(range(4096))


def test_and_when_it_steps_back(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(uuids.time, "time_ns", lambda: 4102444900000 * 1_000_000)
    before = create_uuid()
    monkeypatch.setattr(uuids.time, "time_ns", lambda: 4102444800000 * 1_000_000)
    after = create_uuid()
    assert after.int > before.int
    assert after.bytes[:6] == before.bytes[:6]


def test_the_sequence_is_the_clocks_sub_millisecond_bits(
    monkeypatch: pytest.MonkeyPatch,
):
    # google/uuid fills rand_a with nanoseconds-within-the-millisecond / 256,
    # so two UUIDs from the same millisecond carry its sub-millisecond order.
    monkeypatch.setattr(
        uuids.time, "time_ns", lambda: 4102445000000 * 1_000_000 + 999_999
    )
    minted = create_uuid()
    assert minted.version == 7
    assert minted.bytes[:6] == (4102445000000).to_bytes(6, "big")
    assert int.from_bytes(minted.bytes[6:8], "big") & 0xFFF == 999_999 >> 8


def test_decode_id_names_both_kinds():
    with pytest.raises(InvalidIdException, match="is a project ID, not a volume ID"):
        decode_id("volume", _PROJECT_ID)


def test_is_id_is_false_for_every_other_kind():
    for kind in KINDS:
        assert is_id(kind, _PROJECT_ID) == (kind == "project")


def test_an_unknown_prefix_says_what_is_accepted():
    id = "tpl_" + _PROJECT_ID[4:]
    with pytest.raises(InvalidIdException, match='unknown prefix "tpl"'):
        parse_id(id)
    with pytest.raises(InvalidIdException, match='expected it to start with "prj_"'):
        decode_id("project", id)
    assert not is_id("project", id)


def test_an_unknown_kind_says_what_is_accepted():
    # Reachable from untyped callers, so the check has to be a runtime one.
    with pytest.raises(InvalidIdException, match="is not a resource kind"):
        encode_id(cast(IdKind, "template"), _PROJECT_UUID)


@pytest.mark.parametrize(
    "reason, value",
    [
        ("nothing at all", ""),
        ("a bare encoding with no prefix", _PROJECT_ID[4:]),
        ("a prefix with no encoding", "prj_"),
        ("no separator", _PROJECT_ID.replace("_", "")),
        ("a hyphen instead of an underscore", _PROJECT_ID.replace("_", "-")),
        ("one character short", _PROJECT_ID[:-1]),
        ("one character long", _PROJECT_ID + "a"),
        ("uppercase", _PROJECT_ID.upper()),
        ("an uppercase prefix", "PRJ_" + _PROJECT_ID[4:]),
        ("a character outside the alphabet", _PROJECT_ID[:-1] + "i"),
        ("surrounding whitespace", f" {_PROJECT_ID} "),
        ("an overflowing leading character", "prj_z" + _PROJECT_ID[5:]),
    ],
)
def test_malformed_ids_are_rejected(reason: str, value: str):
    assert not is_id("project", value)
    with pytest.raises(InvalidIdException):
        decode_id("project", value)


def test_the_overflow_case_is_really_the_only_bits_flipped():
    # Index 4 of the id is the leading digit of the encoding. Setting its two
    # high bits leaves a string that a decoder keeping the low 128 bits would
    # happily map to the same UUID; the Go side rejects it as this one does.
    digit = ALPHABET.index(_PROJECT_ID[4])
    overflowing = "prj_" + ALPHABET[digit | 24] + _PROJECT_ID[5:]
    assert len(overflowing) == ID_LENGTH
    assert overflowing != _PROJECT_ID
    with pytest.raises(InvalidIdException, match="above 128 bits"):
        decode_id("project", overflowing)


@pytest.mark.parametrize(
    "reason, value",
    [
        ("not hex", "not-a-uuid"),
        ("one digit short", "019fa519-bf79-724d-8811-a2bfda9755f"),
        ("one digit long", "019fa519-bf79-724d-8811-a2bfda9755faa"),
        ("empty", ""),
        # Hyphens anywhere but 8-4-4-4-12: Go checks the four positions, where
        # uuid.UUID would strip them from anywhere.
        ("hyphenated in the wrong places", "019fa519bf79-724d-8811-a2bf-da9755fa"),
        ("bare but with one hyphen", "019fa519-bf79724d8811a2bfda9755fa"),
        # The prefix has to be the URN one — uuid.UUID takes a bare "uuid:" too
        # — and the braces have to be braces. Go would take "[…]" since it never
        # looks at them, but that is not a spelling anyone writes on purpose.
        (
            "prefixed with something else",
            "uuid:uuid:019fa519-bf79-724d-8811-a2bfda9755fa",
        ),
        ("bare-prefixed", "uuid:019fa519-bf79-724d-8811-a2bfda9755fa"),
        ("bracketed", "[019fa519-bf79-724d-8811-a2bfda9755fa]"),
        ("half braced", "{019fa519-bf79-724d-8811-a2bfda9755fa "),
        ("braced and urn-prefixed", "{urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa}"),
        ("surrounded by whitespace", " 019fa519-bf79-724d-8811-a2bfda9755fa "),
    ],
)
def test_encode_id_rejects_a_uuid_that_is(reason: str, value: str):
    with pytest.raises(InvalidIdException) as caught:
        encode_id("project", value)
    assert caught.value.reason == "uuid"


@pytest.mark.parametrize(
    "value", [None, 123, b"prj_01kyjhkfvse96rg4d2qzd9enft", ["x"], {}]
)
def test_is_id_is_false_for_anything_that_is_not_a_string(value):
    # It used to raise AttributeError from `id.startswith`, which is the worst
    # possible answer for the documented use — validating a JSON payload, where
    # a null or a number is exactly what shows up. `isId` in @e2b/id returns
    # false for all of these, so this is a parity test as much as a guard.
    assert is_id("project", value) is False


@pytest.mark.parametrize(
    "value", [None, 123, b"prj_01kyjhkfvse96rg4d2qzd9enft", ["x"], {}]
)
def test_decode_id_and_parse_id_reject_anything_that_is_not_a_string(value):
    # The same payload handed to decode_id or parse_id has to be an
    # InvalidIdException, which callers turn into a 400, not an AttributeError.
    for call in (lambda: decode_id("project", value), lambda: parse_id(value)):
        with pytest.raises(InvalidIdException) as caught:
            call()
        assert caught.value.reason == "prefix"


@pytest.mark.parametrize("value", ["prjx", "volx", "prj"])
def test_an_id_with_no_separator_names_no_kind(value: str):
    # Pinned on both sides: @e2b/id once sliced to indexOf's -1 here and blamed
    # "prjx" on the project kind.
    with pytest.raises(InvalidIdException) as caught:
        decode_id("volume", value)
    assert caught.value.reason == "prefix"
    assert caught.value.actual_kind is None
    assert 'expected it to start with "vol_"' in str(caught.value)


def test_an_unknown_kind_is_false_rather_than_a_raise():
    assert is_id(cast(IdKind, "template"), _PROJECT_ID) is False


@pytest.mark.parametrize(
    "reason, kind, value",
    [
        ("prefix", "volume", _PROJECT_ID),
        ("prefix", "project", "tpl_" + _PROJECT_ID[4:]),
        ("prefix", "project", _PROJECT_ID[4:]),
        ("length", "project", _PROJECT_ID[:-1]),
        ("alphabet", "project", _PROJECT_ID[:-1] + "i"),
        ("overflow", "project", "prj_z" + _PROJECT_ID[5:]),
    ],
)
def test_the_reason_says_which_failure_it_was(reason: str, kind: IdKind, value: str):
    # Callers branch on `reason`, never on the message text, so rewording a
    # message stays a cosmetic change.
    with pytest.raises(InvalidIdException) as caught:
        decode_id(kind, value)
    assert caught.value.reason == reason


def test_the_reason_for_a_bad_uuid_and_an_unknown_kind():
    with pytest.raises(InvalidIdException) as caught:
        encode_id("project", "not-a-uuid")
    assert caught.value.reason == "uuid"

    with pytest.raises(InvalidIdException) as caught:
        encode_id(cast(IdKind, "template"), _PROJECT_UUID)
    assert caught.value.reason == "kind"


def test_a_kind_mismatch_reports_the_kind_it_actually_names():
    with pytest.raises(InvalidIdException) as caught:
        decode_id("volume", _PROJECT_ID)
    assert caught.value.actual_kind == "project"


def test_id_kind_and_id_prefixes_cannot_diverge():
    # ids.py asserts this at import; if the Literal and the map ever disagree the
    # package refuses to load rather than failing at whatever call site first
    # mints the missing kind.
    from typing import get_args

    assert set(get_args(IdKind)) == set(ID_PREFIXES)


def test_the_public_surface_is_what_all_advertises():
    import e2b_id

    for name in e2b_id.__all__:
        assert hasattr(e2b_id, name), name
    assert "PREFIX_LENGTH" in e2b_id.__all__
    assert e2b_id.PREFIX_LENGTH == 3
