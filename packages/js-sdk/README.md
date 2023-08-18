# E2B JavaScript/TypeScript SDK

The E2B JS/TS SDK provides an interface for managing cloud environments for AI agents.

This SDK gives your agent a full cloud development environment that's sandboxed. That means:

- Access to Linux OS
- Using filesystem (create, list, and delete files and dirs)
- Run processes
- Sandboxed - you can run any code
- Access to the internet

These cloud environments are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.

## Installation

```sh
npm install @e2b/sdk
```

## Usage

### Initialize new cloud environment session

You **start a new session** by creating a `Session` instance via calling the `Session.create` class method.

```ts
import { Session } from '@e2b/sdk'
// You can use some of the predefined environments by using specific id:
// 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
const session = await Session.create({ 
  id: 'Nodejs',
})

// Close the session after you are done
await session.close()
```

### Use filesystem inside cloud environment

```ts
// List
const dirBContent = await session.filesystem.list('/dirA/dirB')

// Write
// This will create a new file 'file.txt' inside the dir 'dirB' with the content 'Hello world'.
await session.filesystem.write('/dirA/dirB/file.txt', 'Hello World')

// Read
const content = await session.filesystem.read('/dirA/dirB/file.txt')

// Remove
// Remove a file.
await session.filesystem.remove('/dirA/dirB/file.txt')
/// Remove a directory and all of its content.
await session.filesystem.remove('/dirA')

// Make dir
// Creates a new directory 'dirC' and also 'dirA' and 'dirB' if those directories don't already exist.
await session.filesystem.makeDir('/dirA/dirB/dirC')

// Watch dir for changes
const watcher = session.filesystem.watchDir('/dirA/dirB')
watcher.addEventListener(event => console.log(event))
await watcher.start()
```

### Start process inside cloud environment

You can **start a new process** in the session by calling `session.process.start`. The only required option is the `cmd`, but you can also define the `rootdir` and `envVars` options that the command should be executed with.

You **send the stdin to the process** by calling `proc.sendStdin`.

You can **manually kill** the process by calling `proc.kill`.

```ts
const proc = await session.process.start({
  cmd: 'echo Hello World',
  onStdout: data => console.log('Stdout', data),
  onStderr: data => console.log('Stderr', data),
  onExit: () => console.log('Exit'),
  rootdir: '/code',
})

await proc.sendStdin('\n')

console.log(proc.processID)

await proc.kill()

// Wait for process to finish
await proc.finished
```

### Create interactive terminal inside cloud environment

```ts
const term = await session.terminal.start({
    onData: data => console.log('Data', data),
    onExit: () => console.log('Exit'),
    size: {
      cols: 80,
      rows: 24,
    },
    rootdir: '/code',
    // If you specify a command, the terminal will be closed after the command finishes.
    // cmd: 'echo Hello World',
})

await term.sendData('echo 1\n')

await term.resize(80, 30)

console.log(term.terminalID)

await term.kill()
```

> If you are using frontend terminal component like [Xtermjs](https://github.com/xtermjs/xterm.js/) you want to pass the data from `onData` handler to Xtermjs and forward the data from Xtermjs to the `term.sendData` method.

### Get public hostname for an exposed port inside cloud environment

```ts
// Get hostname for port 3000. The hostname is without the protocol (http://).
const hostname = session.getHostname(3000)
```

## Development

You generate the types for e2b API from OpenAPI spec by calling:

```sh
npm run generate
```

You build the SDK by calling:

```sh
npm run build
```
