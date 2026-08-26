import re
import time
import uuid as uuidlib
from typing import List, cast

import pytest
from vectors import GOLDEN, GOLDEN_IDS, corpus

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
from e2b_id.codec import ENCODED_LENGTH

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
    assert KINDS == ["project", "workspace", "volume", "sandbox", "user", "group"]
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
    # The point of minting from v7: the bytes a database stores sort by time.
    # Only to the millisecond — within one, the rest of the UUID is random and
    # nothing here adds a counter — so the timestamp field is what is ordered.
    timestamps = [create_uuid().bytes[:6] for _ in range(1000)]
    assert sorted(timestamps) == timestamps


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
        ("a character outside the alphabet", _PROJECT_ID[:-1] + "0"),
        ("surrounding whitespace", f" {_PROJECT_ID} "),
        ("a non-canonical spelling", _PROJECT_ID[:13] + "j" + _PROJECT_ID[14:]),
    ],
)
def test_malformed_ids_are_rejected(reason: str, value: str):
    assert not is_id("project", value)
    with pytest.raises(InvalidIdException):
        decode_id("project", value)


def test_the_non_canonical_case_is_really_the_only_bit_flipped():
    # Index 13 of the id is index 9 of the encoding, the slack digit. Setting
    # its low bits leaves a string that a permissive base32 decoder would
    # happily map to the same UUID.
    non_canonical = _PROJECT_ID[:13] + "j" + _PROJECT_ID[14:]
    assert len(non_canonical) == ID_LENGTH
    assert non_canonical != _PROJECT_ID
    with pytest.raises(InvalidIdException, match="canonical"):
        decode_id("project", non_canonical)


@pytest.mark.parametrize(
    "reason, value",
    [
        ("not hex", "not-a-uuid"),
        # These three are spellings uuid.UUID would accept and this package does
        # not, so that both SDKs take exactly one form.
        ("unhyphenated", "019fa519bf79724d8811a2bfda9755fa"),
        ("braced", "{019fa519-bf79-724d-8811-a2bfda9755fa}"),
        ("urn-prefixed", "urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa"),
        ("one digit short", "019fa519-bf79-724d-8811-a2bfda9755f"),
        ("empty", ""),
    ],
)
def test_encode_id_rejects_a_uuid_that_is(reason: str, value: str):
    with pytest.raises(InvalidIdException):
        encode_id("project", value)


@pytest.mark.parametrize(
    "value", [None, 123, b"prj_uk75vf2v7iagp2kgn7pfze3car", ["x"], {}]
)
def test_is_id_is_false_for_anything_that_is_not_a_string(value):
    # It used to raise AttributeError from `id.startswith`, which is the worst
    # possible answer for the documented use — validating a JSON payload, where
    # a null or a number is exactly what shows up. `isId` in @e2b/id returns
    # false for all of these, so this is a parity test as much as a guard.
    assert is_id("project", value) is False


def test_an_unknown_kind_is_false_rather_than_a_raise():
    assert is_id(cast(IdKind, "template"), _PROJECT_ID) is False


@pytest.mark.parametrize(
    "reason, kind, value",
    [
        ("prefix", "volume", _PROJECT_ID),
        ("prefix", "project", "tpl_" + _PROJECT_ID[4:]),
        ("prefix", "project", _PROJECT_ID[4:]),
        ("length", "project", _PROJECT_ID[:-1]),
        ("alphabet", "project", _PROJECT_ID[:-1] + "0"),
        ("canonical", "project", _PROJECT_ID[:13] + "j" + _PROJECT_ID[14:]),
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
