---
"e2b": patch
---

fix: close httpx client on sandbox kill to prevent connection pool leaks

Close the httpx AsyncClient/Client in the kill() method to prevent TCP connection and file descriptor leaks when sandboxes are destroyed.
