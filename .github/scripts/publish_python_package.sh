#!/bin/sh

# Builds the Python package in the current directory and uploads the
# distribution files that are not on PyPI yet.
#
# `pnpm run -r postPublish` runs this for every Python package on each release,
# including ones whose version was not bumped. Rebuilding an already-published
# version is not byte-identical once the uv_build backend changes (the wheel
# records its generator version), so `uv publish --check-url` rejects it as a
# hash mismatch. Skip files whose name is already published instead.

set -eu

PYPI_URL=${PYPI_URL:-https://pypi.org}

# `uv version` prints "<name> <version>".
set -- $(uv version --frozen)
NAME=$1
VERSION=$2

rm -rf dist
uv build

RELEASE_JSON=$(mktemp)
trap 'rm -f "$RELEASE_JSON"' EXIT

STATUS=$(curl -sS -o "$RELEASE_JSON" -w '%{http_code}' "${PYPI_URL}/pypi/${NAME}/${VERSION}/json")
case "$STATUS" in
  200) ;;
  404) echo '{"urls":[]}' > "$RELEASE_JSON" ;;
  *)
    echo "Unexpected HTTP ${STATUS} checking ${NAME} ${VERSION} on PyPI" >&2
    exit 1
    ;;
esac

MISSING=$(RELEASE_JSON="$RELEASE_JSON" node -e '
  const fs = require("node:fs")
  const release = JSON.parse(fs.readFileSync(process.env.RELEASE_JSON, "utf8"))
  const published = new Set(release.urls.map((u) => u.filename))
  console.log(
    fs.readdirSync("dist")
      .filter((f) => (f.endsWith(".whl") || f.endsWith(".tar.gz")) && !published.has(f))
      .map((f) => `dist/${f}`)
      .join(" ")
  )
')

if [ -z "$MISSING" ]; then
  echo "${NAME} ${VERSION} is already published on PyPI, skipping"
  exit 0
fi

# shellcheck disable=SC2086
uv publish --trusted-publishing always --check-url "${PYPI_URL}/simple/" $MISSING
