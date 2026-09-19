#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the E2B SDK monorepo.
#
# The toolchain (node, pnpm, python, uv, bun, deno) is pinned in the
# repository's top-level `.tool-versions`, so we let `mise` install exactly
# those versions instead of hardcoding them here. Re-running this script only
# reconciles state and must stay a no-op when everything is already in place.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

export PATH="$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"

# Install mise (the version manager) if it isn't already present.
if ! command -v mise >/dev/null 2>&1; then
  curl -fsSL https://mise.run | sh
fi

# Persist mise activation for the agent's interactive shells so node/pnpm/uv/
# bun/deno are on PATH without any manual step.
if ! grep -q 'mise activate bash' "$HOME/.bashrc" 2>/dev/null; then
  {
    echo 'export PATH="$HOME/.local/bin:$PATH"'
    echo 'eval "$(mise activate bash)"'
  } >>"$HOME/.bashrc"
fi

# Install the toolchain versions pinned in .tool-versions and put them on PATH
# for the remainder of this script.
mise trust --quiet
mise install --yes
eval "$(mise activate bash --shims)"

# JavaScript/TypeScript workspace dependencies (frozen to the lockfile).
pnpm install --frozen-lockfile

# Build the JS SDK — the CLI, code-interpreter, desktop packages, and the
# `typecheck`/`test` scripts all depend on its compiled `dist/`.
pnpm --dir packages/js-sdk build

# Python dependencies for each Python package (creates a local .venv each).
for pkg in python-sdk code-interpreter-python desktop-python; do
  (cd "packages/$pkg" && uv sync)
done

echo "E2B SDK environment ready."
