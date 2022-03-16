# Devbook SDK
**Devbook allows developers to try out your app from the documentation page.**

Devbook is a frontend library that lets users to run any code snippet from your documentation or landing page. Devbook does that by spinning up a private VM for every visitor of a page. You control the VM from your frontend.

Check out the [UI Devbook library](https://github.com/devbookhq/ui) that you can use in your documentation.

## How Devbook works
Every time a user visits a page where you use Devbook (like your docs), we quickly spin up a private VM just for that user.
They can experiment and explore your API/SDK right from your docs. Zero setup and overhead.

**Check out [demos](https://twitter.com/mlejva/status/1503730748930490368) of Devbook.**

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
  DevbookStatus,
} from '@devbookhq/sdk'

// 2. Define your code
const code = `
 > Code that you want to execute in a VM goes here.
`

function InteractiveCodeSnippet() {
  // 3. Use the hook
  // Create custom env via Devbook CLI - https://github.com/devbookhq/devbookctl
  const { stdout, stderr, status, fs, runCmd } = useDevbook({ env: 'your-env-id', config: { domain: 'shared.usedevbook.com' } })

  async function handleRun() {
    if (status !== DevbookStatus.Connected) return
    if (!fs) return

    // 4. Manipulate the filesystem
    await fs.write('/index.js', code)
    // 5. Execute the code
    await runCmd(`node ./index.js`)
  }

  return (
    <div>
      {status === DevbookStatus.Disconnected && <div>Status: Disconnected, will start VM</div>}
      {status === DevbookStatus.Connecting && <div>Status: Starting VM...</div>}
      {status === DevbookStatus.Connected && <button onClick={handleRun}>Run</button>}
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
  import { Devbook, DevbookStatus } from '@devbookhq/sdk'

  // 2. Define your code
  const code = `
   > Code that you want to execute in a VM goes here.
  `

  // 3. Create new Devbook instance
  const dbk = new Devbook({
    env: 'your-env-id',
    config: {
      domain: 'shared.usedevbook.com',
    },
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

  if (dbk.status === DevbookStatus.Connected && fs) {
    // 4. Manipulate the filesystem
    await dbk.fs.write('/index.js', code)
    const content = await dbk.fs.get('/index.js')
    console.log('Content of the "/index.js" file', content)

    // 4. Execute the code
    await dbk.runCmd('node /index.js')
  }
```

## Supported runtimes
We support any environments based on Docker images - check out our [CLI tool](https://github.com/devbookhq/devbookctl) for creating and deploying custom Devbook envs.

## Usage of Devbook in example apps
- [React](examples/react-app)
