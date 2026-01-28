# Releasing e2b cli

to create a changeset run     
```bash
pnpm dlx @changesets/cli
```

# Development setup

## Prerequisites

### 1. Install `mise`

macOS (Homebrew):

```sh
brew install mise
```

macOS/Linux (zsh installer + activation):

```sh
curl https://mise.run/zsh | sh
```

Activate `mise` in zsh (needed for shims to work):

```sh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc
exec $SHELL -l
```

### 2. Install `pipx`

macOS (Homebrew):

```sh
brew install pipx
pipx ensurepath
```

### 3. Install tool versions

From the repo root, install everything in `.tool-versions`:

```sh
mise install
```


