# CLI
- CLI program name should be obvious from the NPM package name
- Fix CI/CD deployment (pnpm, SDK)
- Integrate with environmentID in `guide.json`
- Add published/unpublished label to `env list` output
- Add disclaimer when the env is unpublished to `env push`
- Change `/` root to `/code` root in 
  - Handle deleting files that were removed in local filesystem - how can we recognize that the file was deleted? Saving what was pushed last and only manipulating with these files? (lock) If the file changed since then we should probably ignore it (save name+hash that we already calculate for everyting together)
- Allow custom string for template (--select option for the current list?)
- Verify updater
- Fix size and dependencies
- Change template option description
- Finish CLI README

# API
- Add automatic refreshing of edit sessions that are currently being snapshotted
- Wait for the end of POST /envs and PATCH /envs/{codeSnippetID} operations - the mechanism is already implemented
- Add access control to the remaining envs routes and for the edit session request
- Fix clock drift fixing so it happens in the first log2(3) seconds
- Add monitoring to the envs routes
