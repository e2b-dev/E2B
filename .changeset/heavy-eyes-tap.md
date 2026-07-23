---
'@e2b/cli': patch
---

Rebuild the CLI so the bundled `tar` picks up 7.5.19+, fixing the node-tar denial-of-service vulnerabilities (the CLI bundles the SDK and its dependencies into `dist/index.js`)
