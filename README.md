# Devbook SDK

Devbook makes your dev docs interactive with just 3 lines of code.

Devbook is a JS library that allows visitors of your docs to interact and execute any code snippet or shell commands.

## How Devbook works


## Usage

### React
```tsx
import {
  useDevbook,
  Env,
} from '@devbookhq/sdk'

// TODO
const code = `
`

function InteractiveCodeSnippet() {
  const { stdout, stderr, run } = useDevbook({ code, env: Env.NodeJS })

  return (
    <div>
      <button onClick={run}>Run</button>
      <h3>Output</h3>
      {stdout.map((o, idx) => <span key={`out_{idx}`}>{o}</span>)}
      {stderr.map((e, idx) => <span key={`err_{idx}`}>{e}</span>)}
    </div>
  )
}

export default InteractiveCodeSnippet
```

### Vanilla JS
```js
  import { Devbook } from '@devbookhq/sdk'

  // TODO
  const code = `
  `

  function handleStdout(out: string) {
    console.log('stdout', { err })
  }

  function handleStderr(err: string) {
    console.log('stderr', { err })
  }

  const dbk = new Devbook({ onStdout: handleStdout, onStderr: handleStderr })
  dbk.evaluate(code)
```

## Supported runtimes
- NodeJS
- Python 3
- Python 2
- Golang
- Ruby
- Rust

- Custom environment based on a container (coming soon)

## Example apps
- React
- MDX (Docosaurus and other docs themes)
