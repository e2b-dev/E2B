# Devbook SDK
**Devbook makes your dev docs interactive with just 3 lines of code.**

Devbook is a JS library that allows visitors of your docs to interact and execute any code snippet or shell commands in a private VM.

## How Devbook works
Every time a user visits a page where you use Devbook (like your docs), we quickly spin up a private VM just for that user.
They can experiment and explore your API/SDK right from your ocs. Zero setup and overhead.

**Check this [Twitter thread](https://twitter.com/mlejva/status/1482767780265050126) with a video to see Devbook in action.**

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
      {stdout.map((o, idx) => <span key={`out_${idx}`}>{o}</span>)}
      {stderr.map((e, idx) => <span key={`err_${idx}`}>{e}</span>)}
    </div>
  )
}

export default InteractiveCodeSnippet
```

### Vanilla JS
```js
  import { Devbook, Env } from '@devbookhq/sdk'

  // TODO
  const code = `
  `

  function handleStdout(out: string) {
    console.log('stdout', { err })
  }

  function handleStderr(err: string) {
    console.log('stderr', { err })
  }

  const dbk = new Devbook({ env: Env.NodeJS, onStdout: handleStdout, onStderr: handleStderr })
  dbk.evaluate(code)
```

## Supported runtimes
- NodeJS
- Custom environment based on a container (coming soon)

## Usage of Devbook in example apps
- [React](examples/react-app)
- [MDX (Docusaurus and other docs themes)](examples/docusaurus)
