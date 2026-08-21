---
'e2b': patch
---

Fix uploads of non-native `ReadableStream`s in the browser silently sending the text `[object ReadableStream]` instead of the data. Buffering a stream drained it with `new Response(stream)`, which accepts any async iterable on Node (an undici extension) but only its own stream class in a browser, stringifying anything else. Streams are now drained through the reader, which every implementation supports.
