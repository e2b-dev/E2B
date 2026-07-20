#!/usr/bin/env bash
set -euo pipefail

# Fetches API specs from their source-of-truth repositories with Copybara.
#
# Usage: scripts/fetch-spec.sh <api-spec|envd-spec|volume-api-spec>
#
# api-spec and envd-spec come from e2b-dev/infra at the commit pinned in
# spec/infra-ref. Override it with E2B_INFRA_REF, e.g.
# `E2B_INFRA_REF=main pnpm fetch:api-spec` to try the latest spec without
# touching the pin. volume-api-spec comes from e2b-dev/belt at the commit
# pinned in spec/belt-ref (override with E2B_BELT_REF).
#
# All fetches need a GitHub token (belt is private): GITHUB_TOKEN, or being
# logged in with `gh auth login`.

SPEC="${1:?usage: fetch-spec.sh <api-spec|envd-spec|volume-api-spec>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TOKEN="${GITHUB_TOKEN:-$(gh auth token 2> /dev/null || true)}"
if [ -z "$TOKEN" ]; then
  echo "error: a GitHub token is required; set GITHUB_TOKEN or run \`gh auth login\`" >&2
  exit 1
fi

case "$SPEC" in
  api-spec | envd-spec)
    SOURCE="e2b-dev/infra"
    REF="${E2B_INFRA_REF:-$(tr -d '[:space:]' < "$ROOT_DIR/spec/infra-ref")}"
    ;;
  volume-api-spec)
    SOURCE="e2b-dev/belt"
    REF="${E2B_BELT_REF:-$(tr -d '[:space:]' < "$ROOT_DIR/spec/belt-ref")}"
    ;;
  *)
    echo "error: unknown spec '$SPEC'" >&2
    exit 1
    ;;
esac

STAGING=".copybara/$SPEC"

echo "Fetching $SPEC from $SOURCE@$REF"

# Set COPYBARA_IMAGE to skip the image build and use a prebuilt image instead
# (CI builds it separately with a warm buildkit cache).
if [ -z "${COPYBARA_IMAGE:-}" ]; then
  docker build -q -t e2b-copybara - < "$ROOT_DIR/copybara.Dockerfile"
  COPYBARA_IMAGE=e2b-copybara
fi

rm -rf "$ROOT_DIR/$STAGING"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e GH_TOKEN="$TOKEN" \
  -v "$ROOT_DIR:/workspace" \
  "$COPYBARA_IMAGE" \
  migrate /workspace/copy.bara.sky "$SPEC" "$REF" \
  --folder-dir "/workspace/$STAGING"

cp -R "$ROOT_DIR/$STAGING/." "$ROOT_DIR/spec/"
rm -rf "$ROOT_DIR/.copybara"

echo "Updated spec/ from $SPEC ($SOURCE@$REF)"
