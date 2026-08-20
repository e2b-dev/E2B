/**
 * The e2e tier: files whose assertions depend on real behavior across the RPC
 * boundary in envd or the control plane — process execution, filesystem
 * round-trips, PTY semantics, git inside the VM, sandbox lifecycle against live
 * infrastructure and server-side template builds. They provision sandboxes, so
 * they only run with `E2B_E2E=1` and credentials (`pnpm test:e2e`).
 *
 * Everything else is fully mocked and runs by default. The directories below
 * hold behavioral tests only — the client-side logic that used to live next to
 * them (commandHandle, entryInfo, watchHandle, gitValidation) sits one level up.
 */
export const e2eFiles = [
  'tests/api/{info,kill,list,snapshot}.test.ts',
  'tests/sandbox/commands/**/*.test.ts',
  'tests/sandbox/files/**/*.test.ts',
  'tests/sandbox/git/**/*.test.ts',
  'tests/sandbox/pty/**/*.test.ts',
  'tests/sandbox/{connect,create,fork,host,internetAccess,kill,lifecycleBehavior,metrics,network,secure,snapshot,snapshot-api,timeout}.test.ts',
  'tests/template/{backgroundBuild,build,exists,tagsBuild}.test.ts',
  'tests/template/methods/{makeSymlink,runCmd}.test.ts',
]
