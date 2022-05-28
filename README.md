# Devbook SDK

## Installation
```sh
npm install @devbookhq/sdk
```

## Usage

### JS/TS
```js
async function main() {
  const session = new Session('<codeSnippetID>', {
    onStateChange(state) {
      console.log(state)
    },
    onStderr(stderr) {
      console.log(stderr)
    },
    onStdout(stdout) {
      console.log(stdout)
    },
  })

  try {
    await session.connect()
    await session.run('console.log("4")')
  } catch (e) {
    console.error(e)
  }
}

main()
```

## Development

Set the env var `DEBUG=1` to enable detailed logs from the SDK.

### Subtrees

#### shared
Shared is a subtree made from https://github.com/devbookhq/shared repository.

The subtree commands you need for controling this repo are:
```bash
git subtree add --prefix shared https://github.com/devbookhq/shared.git master
```

```bash
git subtree pull --prefix shared https://github.com/devbookhq/shared.git master
```

```bash
git subtree push --prefix shared https://github.com/devbookhq/shared.git master
```
