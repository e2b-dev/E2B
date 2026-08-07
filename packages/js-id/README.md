# `@e2b/id`

Prefixed, human-legible IDs for E2B resources. No dependencies.

```sh
npm install @e2b/id
```

```ts
import { createId, decodeId, encodeId, isId, parseId } from '@e2b/id'

createId('project')
// 'prj_uk75vf2v7iagp2kgn7pfze3car'

encodeId('volume', '019fa519-bfc5-784d-9386-a5d7a93a692a')
// 'vol_uxl2sotjfiagp2kgn7yv4e3e4g'

decodeId('volume', 'vol_uxl2sotjfiagp2kgn7yv4e3e4g')
// '019fa519-bfc5-784d-9386-a5d7a93a692a'

parseId('vol_uxl2sotjfiagp2kgn7yv4e3e4g')
// { kind: 'volume', uuid: '019fa519-bfc5-784d-9386-a5d7a93a692a' }

isId('project', 'vol_uxl2sotjfiagp2kgn7yv4e3e4g')
// false
```

[`e2b_id`](../python-id) is the same format in Python, name for name — its
README lists [the one place they differ](../python-id/README.md#where-this-differs-from-e2bid)
(Python moves `uuid.UUID` objects where JS moves hex strings).

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

The alphabet is exactly the one Python's `base64.b32encode` uses, so any
language can read these IDs with its standard library and no tables:

```py
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
`decodeId` accepts only the one `encodeId` produces and throws `InvalidIdError`
for the other three, along with uppercase, padding and anything outside the
alphabet. UUID arguments are held to the canonical 8-4-4-4-12 hex form for the
same reason.

### Types

`Id<K>` is a template literal type, so the prefix is checked at compile time and
`isId` narrows to it:

```ts
import type { Id } from '@e2b/id'

function open(volume: Id<'volume'>) {}

open(createId('volume')) // fine
open(createId('project')) // Argument of type 'prj_${string}' is not assignable

declare const input: string
if (isId('volume', input)) open(input) // narrowed to Id<'volume'>
```

## API

| | |
| --- | --- |
| `createId(kind)` | mint an ID for a new resource, from a fresh UUIDv7 |
| `encodeId(kind, uuid)` | encode a UUID you already have |
| `decodeId(kind, id)` | the UUID an ID carries; throws if the kind is wrong |
| `parseId(id)` | `{ kind, uuid }`, when the kind is what you want to find out |
| `isId(kind, value)` | `decodeId` without the throw, and a type guard; `false` for non-strings |
| `createUuid()` | mint a UUIDv7 |
| `encodeBytes(bytes)` / `decodeBytes(encoded)` | the prefix-free codec, over any 16 bytes |
| `uuidToBytes(uuid)` / `bytesToUuid(bytes)` | the canonical hex form and back |
| `ID_PREFIXES`, `ID_LENGTH`, `ENCODED_LENGTH`, `DECODED_LENGTH`, `ALPHABET` | the constants above |
| `Id`, `IdKind`, `IdPrefix`, `ParsedId`, `InvalidIdError`, `InvalidIdReason` | the types |

## Development

```sh
pnpm build
pnpm test
pnpm lint && pnpm typecheck
```

`tests/vectors.ts` and `packages/python-id/tests/vectors.py` are the same file in
two languages: the same golden encodings, the same seeded corpus, and the same
`CORPUS_DIGEST` over it. Changing the format on one side alone fails on both.
`pnpm test` also pipes the whole corpus through `python3` to check the six-line
snippet above.
