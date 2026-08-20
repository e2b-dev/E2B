---
'@e2b/python-sdk': patch
'@e2b/cli': patch
'e2b': patch
---

Split the test suites into a fully mocked default tier and an opt-in `E2B_E2E=1` end-to-end tier (tests only, no runtime changes)
