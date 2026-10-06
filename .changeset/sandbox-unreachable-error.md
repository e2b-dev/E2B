---
'@e2b/python-sdk': patch
'e2b': patch
---

Add `SandboxUnreachableError` (JS) / `SandboxUnreachableException` (Python), raised when a request to the sandbox fails at the connection level and the follow-up health probe gets no answer from the sandbox either. Requests whose connection to the sandbox could not be established now run the same health probe as requests whose connection was dropped mid-request, so a killed sandbox surfaces as a `TimeoutError` instead of a raw connection error.
