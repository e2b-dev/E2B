---
"@e2b/python-sdk": patch
---

Port the JS SDK's `stripAnsi` regex to the Python SDK's `strip_ansi_escape_codes`, aligning both implementations. OSC sequences (hyperlinks, window titles) are now matched non-greedily up to the first string terminator — including sequences spanning newlines — and CSI sequences are stripped without requiring a terminator, so template build logs are cleaned identically in both SDKs.
