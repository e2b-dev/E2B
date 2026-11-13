#!/bin/sh

set -eu

pnpm --filter @e2b/python-sdk run postPublish

VERSION=$(node -p "require('./packages/python-sdk/package.json').version")
TAG="@e2b/python-sdk@${VERSION}"
git tag -a "$TAG" -m "$TAG"
# changesets/action pushes this tag and creates the GitHub release.
printf 'New tag: %s\n' "$TAG"
