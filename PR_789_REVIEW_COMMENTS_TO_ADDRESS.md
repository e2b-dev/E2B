# PR #789 Review Comments - Action Items

## Overview
Based on the actual GitHub PR review comments for **PR #789: "Make sandbox metadata available globally in envd"**, here are the specific issues that need to be addressed:

## Specific Review Comments to Address

### 1. **Makefile Typo** (Comment by @jakubno)
**File**: `packages/envd/Makefile` (line 21)
**Issue**: Missing space in Docker build command
**Fix needed**: 
```diff
- DOCKER_BUILDKIT=1 docker build -t envd-debug. -f debug.Dockerfile
+ DOCKER_BUILDKIT=1 docker build -t envd-debug . -f debug.Dockerfile
```
**Status**: Author acknowledged and said it was fixed

### 2. **ENV_ID vs TEMPLATE_ID** (Comment by @dobrac)
**File**: `packages/envd/internal/host/mmds.go`
**Issue**: Question about whether `ENV_ID` should be `TEMPLATE_ID`
**Review comment**: "can this be TEMPLATE_ID?"
**Reaction**: Got a thumbs up, suggesting this change should be made
**Action needed**: Consider renaming `E2B_ENV_ID` to `E2B_TEMPLATE_ID` for clarity

### 3. **Localhost Address Won't Work** (Comment by @jakubno)
**File**: `packages/envd/internal/logs/exporter/exporter.go` (line 81)
**Issue**: Default localhost address won't work inside sandbox
**Current problematic code**:
```go
Address: "http://localhost:30006", // default logs collector address
```
**Fix needed**: Use empty string and add logic to not send requests when address is empty
**Status**: Author acknowledged: "good point, ill add that logic"

### 4. **Debug-Only Logging** (Comment by @0div)
**File**: `packages/envd/internal/host/mmds.go` (line 138) 
**Issue**: Error logs should only appear in debug mode
**Author's response**: "They are not, but useful for debugging local dev, could add `if debug {`"
**Action needed**: Wrap debug-only logs with debug condition

### 5. **Code Cleanup** (Comment by @0div)
**File**: `packages/envd/internal/logs/exporter/exporter.go` (line 71)
**Issue**: "forgot to remove that line"
**Action needed**: Remove the leftover line that was supposed to be deleted

### 6. **Handle MMDS Changes During Runtime** (Comment by @dobrac)
**File**: `packages/envd/internal/logs/exporter/exporter.go` (line 79)
**Issue**: "we should still handle if the mmds change in the sandbox runtime, for example to not break it for cloning/snapshotting"
**Author's response**: Will prevent making HTTP requests for each logger call and call it on init
**Action needed**: Implement proper MMDS change handling for runtime scenarios

### 7. **Don't Send Logs Without Metadata** (Comment by @dobrac)
**File**: `packages/envd/internal/logs/exporter/exporter.go` (line 91)
**Issue**: "why to send logs when we don't have correct metadata? They'll get lost anyway"
**Action needed**: Add logic to skip sending logs when metadata is not available

## Technical Context

From the PR description, this change:
- Moves MMDS options polling outside of the log exporter
- Uses channels for non-blocking communication
- Stores sandbox metadata in both environment variables and files (`/etc/.E2B_*`)
- Renames `instanceID` to `sandboxID` for consistency
- Makes metadata available via: `E2B_SANDBOX_ID`, `E2B_TEAM_ID`, `E2B_TEMPLATE_ID` (or `E2B_ENV_ID`)

## Files to Modify

Based on the review comments, these files need changes:
1. `packages/envd/Makefile` - Fix typo
2. `packages/envd/internal/host/mmds.go` - Debug logging, ENV_ID→TEMPLATE_ID
3. `packages/envd/internal/logs/exporter/exporter.go` - Address handling, code cleanup, MMDS runtime changes

## Next Steps

Since I cannot access the actual changed files (they're on the PR branch), the PR author (@0div) needs to:

1. ✅ Fix the Makefile typo (already acknowledged)
2. 🔄 Consider renaming ENV_ID to TEMPLATE_ID  
3. 🔄 Fix localhost address issue with proper empty string handling
4. 🔄 Add debug-only logging conditions
5. 🔄 Remove leftover code lines
6. 🔄 Implement proper MMDS runtime change handling
7. 🔄 Add logic to skip logs when metadata unavailable

## Status
- Most issues have been acknowledged by the PR author
- Implementation of fixes is in progress
- PR is currently open and under active review