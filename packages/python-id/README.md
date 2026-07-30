# `e2b_id`

Prefixed, human-legible IDs for E2B resources. Standard library only.

> **Not on PyPI yet.** Publishing needs a PyPI project and a scoped token first;
> until then use it from this repo (`uv add ../python-id`). See
> [Releasing](#releasing).

```python
from e2b_id import create_id, decode_id, encode_id, is_id, parse_id

create_id("project")
# 'prj_uk75vf2v7iagp2kgn7pfze3car'

encode_id("volume", "019fa519-bfc5-784d-9386-a5d7a93a692a")
# 'vol_uxl2sotjfiagp2kgn7yv4e3e4g'

decode_id("volume", "vol_uxl2sotjfiagp2kgn7yv4e3e4g")
# UUID('019fa519-bfc5-784d-9386-a5d7a93a692a')

parse_id("vol_uxl2sotjfiagp2kgn7yv4e3e4g")
# ParsedId(kind='volume', uuid=UUID('019fa519-bfc5-784d-9386-a5d7a93a692a'))

is_id("project", "vol_uxl2sotjfiagp2kgn7yv4e3e4g")
# False
```

[`@e2b/id`](../js-id) is the same format in TypeScript, name for name — see
[the one place they differ](#where-this-differs-from-e2bid).

## The format

An ID is a three-character kind prefix, an underscore, and 26 characters of
encoded UUID — 30 characters in all:

```text
prj_uk75vf2v7iagp2kgn7pfze3car
wrk_imkhttdroeagp2kgn7t53cvkiw
vol_uxl2sotjfiagp2kgn7yv4e3e4g
sbx_blo7looa3eagp2kgn75n47fkrk
usr_zm52rsumcyagp2kgoacf6i5ibz
grp_byblfq6upe6r5mcc2yzrbxfjlh
```

| kind        | prefix |
| ----------- | ------ |
| `project`   | `prj`  |
| `workspace` | `wrk`  |
| `volume`    | `vol`  |
| `sandbox`   | `sbx`  |
| `user`      | `usr`  |
| `group`     | `grp`  |

The UUID's 16 bytes are base32-encoded with the RFC 4648 section 6 alphabet
(`a-z2-7`), lowercased, unpadded — 26 characters — and then **rotated left by
16**, so what was the first character ends up 11th.

The rotation is the whole trick. A UUIDv7 leads with a 48-bit millisecond
timestamp, so unrotated encodings of IDs minted around the same time share a
long common prefix, and the leading characters barely move for months. Rotating
puts 10 characters of random bits in front, the timestamp from index 10, and the
rest of the random bits behind it. The trade is that encoded order no longer
follows time — don't build an index expecting it to.

The alphabet is exactly the one `base64.b32encode` uses, so any language can
read these IDs with its standard library and no tables:

```python
import base64

def encode(b: bytes) -> str:
    s = base64.b32encode(b).decode().rstrip("=").lower()
    return s[16:] + s[:16]

def decode(s: str) -> bytes:
    s = s[10:] + s[:10]
    return base64.b32decode(s.upper() + "======")
```

### One spelling per ID

26 base32 digits carry 130 bits and a UUID has 128, so two bits of the encoding
are always zero and every UUID has four strings a permissive decoder maps to it.
`decode_id` accepts only the one `encode_id` produces and raises
`InvalidIdException` for the other three, along with uppercase, padding and
anything outside the alphabet. UUID arguments are held to the canonical
8-4-4-4-12 hex form for the same reason, even though `uuid.UUID` itself would
take braced and unhyphenated spellings.

## API

| | |
| --- | --- |
| `create_id(kind)` | mint an ID for a new resource, from a fresh UUIDv7 |
| `encode_id(kind, uuid)` | encode a UUID you already have |
| `decode_id(kind, id)` | the UUID an ID carries; raises if the kind is wrong |
| `parse_id(id)` | `ParsedId(kind, uuid)`, when the kind is what you want to find out |
| `is_id(kind, value)` | `decode_id` without the raise; `False` for non-strings |
| `create_uuid()` | mint a UUIDv7 (`uuid.uuid7` needs Python 3.14) |
| `encode_bytes(raw)` / `decode_bytes(encoded)` | the prefix-free codec, over any 16 bytes |
| `ID_PREFIXES`, `ID_LENGTH`, `ENCODED_LENGTH`, `DECODED_LENGTH`, `ALPHABET` | the constants above |
| `IdKind`, `ParsedId`, `InvalidIdException`, `InvalidIdReason` | the types |

### Where this differs from `@e2b/id`

Everything above is named identically in both packages. The only divergence is
that JavaScript has no UUID type, so `@e2b/id` moves UUIDs as canonical hex
strings where this package moves `uuid.UUID` objects:

- `@e2b/id` also exports `uuidToBytes`/`bytesToUuid`; here `u.bytes` and
  `uuid.UUID(bytes=…)` already are those.
- `create_uuid()`, `decode_id()` and `ParsedId.uuid` give you a `uuid.UUID`,
  where their JS counterparts give a string — so a round trip is string-to-string
  in JS but not here.
- `encode_id()` takes either a `uuid.UUID` or the hex form.

## Development

```sh
uv sync
uv run pytest
uv run make lint typecheck
```

`tests/vectors.py` and `packages/js-id/tests/vectors.ts` are the same file in
two languages: the same golden encodings, the same seeded corpus, and the same
`CORPUS_DIGEST` over it. Changing the format on one side alone fails on both.

## Releasing

This package is deliberately **not** wired into the release pipeline yet.
`packages/python-sdk/package.json` publishes via a `postPublish` script
(`uv build && uv publish --token ${PYPI_TOKEN}`); `packages/python-id` has no
such script, because pointing one at a PyPI project that does not exist — with a
token that may not be scoped for it — would fail `pnpm run publish` and take the
whole monorepo's release down with it.

To publish for the first time: register the `e2b_id` project on PyPI, confirm
`PYPI_TOKEN` covers it, then add the same `postPublish` line python-sdk has.
