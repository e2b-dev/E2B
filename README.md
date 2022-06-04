# Devbook SDK

## Installation
```sh
npm install @devbookhq/sdk
```

## Usage

### JS/TS
```js
import { Session } from '@devbookhq/sdk'

async function main() {
  const session = new Session({
    id: '<code-snippet-id>',
    codeSnippet: {
      onStateChange(state) {
        console.log(state)
      },
      onStderr(stderr) {
        console.log(stderr)
      },
      onStdout(stdout) {
        console.log(stdout)
      },
    },
  })

  try {
    await session.open()
    await session.codeSnippet?.run('console.error("test")')
  } catch (e) {
    console.error(e)
  }
}

main()
```

## Development

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
