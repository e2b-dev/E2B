---
'e2b': patch
---

Fix template build error stack traces under Bun. `remove`, `rename`, `makeDir`, `makeSymlink`, `pipInstall`, `npmInstall`, `bunInstall`, `aptInstall`, `addMcpServer`, `gitClone`, `betaDevContainerPrebuild`, and `betaSetDevContainerStart` now capture the caller stack trace in the method body itself. Bun's JavaScriptCore engine elides tail-call frames (including the `const r = f(); return r` form), which previously made build errors from these methods point at the wrong stack frame when running under Bun.
