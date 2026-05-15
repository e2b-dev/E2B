---
"@e2b/cli": patch
"e2b": patch
---

fix: resolve TypeScript deprecated configs and improve type support

## What changed

Updated TypeScript compiler options in both CLI and JS-SDK packages to remove deprecated settings that will stop working in TypeScript 7.0:

### CLI Package (`packages/cli/tsconfig.json`)
- Changed `moduleResolution` from `"node"` to `"bundler"` (modern recommended approach)
- Removed `downlevelIteration` option (deprecated, no longer needed)
- Added `types: ["node"]` to properly resolve Node.js type definitions

### JS-SDK Package (`packages/js-sdk/tsconfig.json`)
- Changed `moduleResolution` from `"node"` to `"bundler"` (modern recommended approach)
- Fixed JSON syntax error (removed trailing comma)

### Dependencies
- Added `@types/node ^20.19.19` as a dev dependency to provide type definitions for Node.js built-in modules (os, path, fs, process)

## Why this change was made

The current TypeScript configuration uses deprecated compiler options that will stop functioning in TypeScript 7.0. This change ensures:
- Forward compatibility with TypeScript 7.0+
- Proper type checking for Node.js modules used in the CLI package
- Modern module resolution strategy that better supports both ESM and CommonJS

## How to verify

All changes have been tested and verified:
- ✅ `pnpm run typecheck` - All TypeScript compilation errors resolved
- ✅ `pnpm run lint` - Code style checks pass
- ✅ `pnpm run format` - Code formatting is correct
- ✅ Dependencies installed successfully (584 packages)

No breaking changes for users. This is a maintenance fix to ensure compatibility with future TypeScript versions.
