# Devbook SDK
**Devbook makes your dev docs interactive with just 3 lines of code.**

Devbook is a JS library that allows visitors of your docs to interact with and execute any code snippet or shell command in a private VM.

## How Devbook works
Every time a user visits a page where you use Devbook (like your docs), we quickly spin up a private VM just for that user.
They can experiment and explore your API/SDK right from your docs. Zero setup and overhead.

**Check this [Twitter thread](https://twitter.com/mlejva/status/1482767780265050126) with a video to see Devbook in action.**

## Installation
```sh
npm install @devbookhq/sdk
```
## Usage

### React
```tsx
// 1. Import the hook
import {
  useDevbook,
  Env,
  DevbookStatus,
} from '@devbookhq/sdk'

// 2. Define your code
const code = `
 > Code that you want to execute in a VM goes here.
`

function InteractiveCodeSnippet() {
  // 3. Use the hook
  const { stdout, stderr, status, runCode } = useDevbook({ env: Env.NodeJS })

  function handleRun() {
    // 4. Execute the code
    runCode(code)
  }

  return (
    <div>
      {status === DevbookStatus.Disconnected && <div>Status: Disconnected, will start VM</div>}
      {status === DevbookStatus.Connecting && <div>Status: Starting VM...</div>}
      {status === DevbookStatus.Connected && (
        <button onClick={handleRun}>Run</button>
      )}
      <h3>Output</h3>
      {stdout.map((o, idx) => <span key={`out_${idx}`}>{o}</span>)}
      {stderr.map((e, idx) => <span key={`err_${idx}`}>{e}</span>)}
    </div>
  )
}

export default InteractiveCodeSnippet
```

### JavaScript/TypeScript
```ts
  // 1. Import the class
  import { Devbook, Env, DevbookStatus } from '@devbookhq/sdk'

  // 2. Define your code
  const code = `
   > Code that you want to execute in a VM goes here.
  `

  // 3. Create new Devbook instance
  const dbk = new Devbook({
    env: Env.NodeJS,
    onStdout(out) {
      console.log('stdout', { err })
    },
    onStderr(err) {
      console.log('stderr', { err })
    },
    onStatusChange(status) {
      console.log('status', { status })
    },
  })

  // 4. Execute the code
  if (dbk.status === DevbookStatus.Connected) {
    dbk.runCode(code)
  }
```

## Supported runtimes
- NodeJS
- Looking for more runtimes? Please open an issue
- *(coming soon)* Custom environments based on containers

## Usage of Devbook in example apps
- [React](examples/react-app)
- [MDX (Docusaurus and other docs themes)](examples/docusaurus)
