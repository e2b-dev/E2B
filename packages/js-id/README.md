# `@e2b/id`

Prefixed, human-legible IDs for E2B resources. No dependencies.

```sh
npm install @e2b/id
```

```ts
import { createId, decodeId, encodeId, isId, parseId } from '@e2b/id'

createId('project')
// 'prj_01kyjhkfvse96rg4d2qzd9enft'

encodeId('volume', '019fa519-bfc5-784d-9386-a5d7a93a692a')
// 'vol_01kyjhkfy5f16s71n5tymkmt9a'

decodeId('volume', 'vol_01kyjhkfy5f16s71n5tymkmt9a')
// '019fa519-bfc5-784d-9386-a5d7a93a692a'

parseId('vol_01kyjhkfy5f16s71n5tymkmt9a')
// { kind: 'volume', uuid: '019fa519-bfc5-784d-9386-a5d7a93a692a' }

isId('project', 'vol_01kyjhkfy5f16s71n5tymkmt9a')
// false
```

The format is deliberately portable: any TypeID library reads it, and so does
any language with integers. A Python port lands alongside this one.

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

```py
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
UUID has four strings a careless decoder maps to it. `decodeId` accepts only the
one `encodeId` produces and throws `InvalidIdError` for the other three, along
with uppercase, padding and anything outside the alphabet — exactly what the Go
side rejects.

### UUIDs, the way Go reads and mints them

`encodeId` takes a UUID in any of the four spellings `google/uuid`'s `Parse`
accepts, and only those: hyphenated `8-4-4-4-12`, the same after `urn:uuid:` or
in braces, or 32 bare hex digits, in either case. Nothing checks the version or
variant bits, because Go does not. Everything this package returns is the
lowercase hyphenated form, as Go's `String` is.

`createUuid` mints a UUIDv7 the way `NewV7` does: a millisecond timestamp, then
a 12-bit sequence that makes every UUID this process mints strictly greater
than the last, even within a millisecond and even if the clock steps back, then
62 random bits. So `createId` output sorts in call order.

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
| `createUuid()` | mint a UUIDv7, monotonic per process like `google/uuid`'s |
| `encodeBytes(bytes)` / `decodeBytes(encoded)` | the prefix-free codec, over any 16 bytes |
| `uuidToBytes(uuid)` / `bytesToUuid(bytes)` | Go's four UUID spellings to bytes, and back to the hyphenated one |
| `ID_PREFIXES`, `ID_LENGTH`, `ENCODED_LENGTH`, `DECODED_LENGTH`, `ALPHABET` | the constants above |
| `Id`, `IdKind`, `IdPrefix`, `ParsedId`, `InvalidIdError`, `InvalidIdReason` | the types |

## Development

```sh
pnpm build
pnpm test
pnpm lint && pnpm typecheck
```

`tests/vectors.ts` holds the golden encodings (the Go suite's among them), a
seeded 1306-value corpus and a `CORPUS_DIGEST` over it. Every port of this format
pins the same three, so a change to the format on one side alone cannot pass on
the other. `pnpm test` also pipes the whole corpus through `python3` to check the
snippet above.
