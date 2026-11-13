# `e2b_id`

Prefixed, human-legible IDs for E2B resources. Standard library only —
`e2b-id` on PyPI, `import e2b_id` in code.

```sh
pip install e2b-id
```

```python
from e2b_id import create_id, decode_id, encode_id, is_id, parse_id

create_id("project")
# 'prj_01kyjhkfvse96rg4d2qzd9enft'

encode_id("volume", "019fa519-bfc5-784d-9386-a5d7a93a692a")
# 'vol_01kyjhkfy5f16s71n5tymkmt9a'

decode_id("volume", "vol_01kyjhkfy5f16s71n5tymkmt9a")
# UUID('019fa519-bfc5-784d-9386-a5d7a93a692a')

parse_id("vol_01kyjhkfy5f16s71n5tymkmt9a")
# ParsedId(kind='volume', uuid=UUID('019fa519-bfc5-784d-9386-a5d7a93a692a'))

is_id("project", "vol_01kyjhkfy5f16s71n5tymkmt9a")
# False
```

[`@e2b/id`](../js-id) is the same format in TypeScript, name for name — see
[the one place they differ](#where-this-differs-from-e2bid).

## The format

An ID is a three-character kind prefix, an underscore, and 26 characters of
encoded UUID — 30 characters in all:

```text
prj_7mfb0gpp6c8dsaasre0asc7n3s
wrk_7mfb0gpp6c8dsaasre0asc7n3s
sec_01kyjhkfvse96rg4d2qzd9enft
vol_01kyjhkfy5f16s71n5tymkmt9a
sbx_01kyjhkfzbf7samagavqtvkg6s
usr_01kyjhkg0hfj7a0eeb7emcn30p
grp_2n1t201rmv87aae5j4csam8000
```

| kind        | prefix |
| ----------- | ------ |
| `project`   | `prj`  |
| `workspace` | `wrk`  |
| `secret`    | `sec`  |
| `volume`    | `vol`  |
| `sandbox`   | `sbx`  |
| `user`      | `usr`  |
| `group`     | `grp`  |

The encoding is [TypeID](https://github.com/jetify-com/typeid)'s: the UUID's
128 bits written in base 32 with the Crockford alphabet (`0-9a-z` minus `i`,
`l`, `o` and `u`), lowercase, most significant digit first, left-padded to 26
digits. 26 digits hold 130 bits, so the first character carries two zero bits
and is always `0` to `7`.

This is the format E2B's services emit and accept — the Go side is
[`packages/shared/pkg/id`](https://github.com/e2b-dev/infra/tree/main/packages/shared/pkg/id)
in e2b-dev/infra, built on `github.com/sumup/typeid`, and its test vectors are
pinned in this package's suite. `project`, `workspace` and `secret` are the
kinds it defines, with the same prefixes; the other four are ahead of it. Any
TypeID library reads these IDs, and so does any language with integers:

```python
ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

def encode(b: bytes) -> str:
    n = int.from_bytes(b, "big")
    return "".join(ALPHABET[(n >> (5 * i)) & 31] for i in range(25, -1, -1))

def decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 32 + ALPHABET.index(c)
    return n.to_bytes(16, "big")
```

The digits are the bits in order, so IDs sort the way their UUIDs do. A UUIDv7
leads with a millisecond timestamp, and so its IDs are ordered by mint time —
which also means IDs minted together share a long prefix. The tail is the
distinctive part to read.

### One spelling per ID

A leading character above `7` spells a value no 16 bytes can hold, so every
UUID has four strings a careless decoder maps to it. `decode_id` accepts only
the one `encode_id` produces and raises `InvalidIdException` for the other
three, along with uppercase, padding and anything outside the alphabet — exactly
what the Go side rejects.

### UUIDs, the way Go reads and mints them

`encode_id` takes a `uuid.UUID`, or a string in any of the four spellings
`google/uuid`'s `Parse` accepts, and only those: hyphenated `8-4-4-4-12`, the
same after `urn:uuid:` or in braces, or 32 bare hex digits, in either case.
That is narrower than `uuid.UUID()` itself, which would also take hyphens
anywhere and a bare `uuid:` prefix that Go would not. Nothing checks the version
or variant bits, because Go does not.

`create_uuid` mints a UUIDv7 the way `NewV7` does, line for line: a millisecond
timestamp, then a 12-bit sequence taken from the clock's sub-millisecond bits
and bumped so that every UUID this process mints is strictly greater than the
last, even within a millisecond and even if the clock steps back, then 62 random
bits. So `create_id` output sorts in call order.

## API

| | |
| --- | --- |
| `create_id(kind)` | mint an ID for a new resource, from a fresh UUIDv7 |
| `encode_id(kind, uuid)` | encode a UUID you already have |
| `decode_id(kind, id)` | the UUID an ID carries; raises if the kind is wrong |
| `parse_id(id)` | `ParsedId(kind, uuid)`, when the kind is what you want to find out |
| `is_id(kind, value)` | `decode_id` without the raise; `False` for non-strings |
| `create_uuid()` | mint a UUIDv7, monotonic per process like `google/uuid`'s |
| `encode_bytes(raw)` / `decode_bytes(encoded)` | the prefix-free codec, over any 16 bytes |
| `ID_PREFIXES`, `ID_LENGTH`, `ENCODED_LENGTH`, `DECODED_LENGTH`, `ALPHABET` | the constants above |
| `IdKind`, `ParsedId`, `InvalidIdException`, `InvalidIdReason` | the types |

### Where this differs from `@e2b/id`

Everything above is named identically in both packages. The one divergence in
the surface is that JavaScript has no UUID type, so `@e2b/id` moves UUIDs as
hex strings where this package moves `uuid.UUID` objects:

- `@e2b/id` also exports `uuidToBytes`/`bytesToUuid`; here `u.bytes` and
  `uuid.UUID(bytes=…)` already are those.
- `create_uuid()`, `decode_id()` and `ParsedId.uuid` give you a `uuid.UUID`,
  where their JS counterparts give a string — so a round trip is string-to-string
  in JS but not here.
- `encode_id()` takes either a `uuid.UUID` or a string; `encodeId` takes only
  the string. Both accept the same four string spellings.

And one in what `create_uuid()` puts in the 12-bit sequence: here it is the
clock's sub-millisecond bits, as in Go, because `time.time_ns()` has them.
JavaScript's `Date.now()` is whole milliseconds, so `createUuid()` counts up
from zero within each millisecond instead. The guarantee is the same on both
sides — every UUID a process mints is greater than the last — but two processes
minting in the same millisecond interleave by sub-millisecond time in Python
and Go, and arbitrarily in JavaScript.

## Development

```sh
uv sync
uv run pytest
uv run make lint typecheck
```

`tests/vectors.py` and `packages/js-id/tests/vectors.ts` are the same file in
two languages: the same golden encodings (the Go suite's among them), the same
seeded corpus, and the same `CORPUS_DIGEST` over it. Changing the format on one
side alone fails on both.
