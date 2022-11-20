# Devbook SDK

SDK for managing Devbook sessions from JavaScript/TypeScript. Devbook SDK requires [`devbookd`](https://github.com/devbookhq/devbookd) running on the server to which it's connecting.

## Installation

```sh
npm install @devbookhq/sdk
```

or

```sh
yarn add @devbookhq/sdk
```

## Usage

### Open a new session

You **start a new session** by creating a `Session` instance and calling the `session.open` method.

`<code-snippet-id>` is the ID of the environment from Devbook backend.

When creating the `Session` you can **register handlers for various session events** by passing the handlers to the `Session` constructor.

You can **manually close** the session by calling `session.close`. If you need to open the session again after calling `session.close` you have to create a new `Session` object and call `session.open` on it.

```ts
import { Session } from '@devbookhq/sdk'

const session = new Session({
  id: '<code-snippet-id>',
  // Options for connection to a special session with persistent changes
  editEnabled: false,
  apiKey: undefined,
  // Event handlers
  codeSnippet: {
    onStateChange: state => console.log(state),
    onStderr: stderr => console.log(stderr),
    onStdout: stdout => console.log(stdout),
  },
  onDisconnect: () => console.log('disconnect'),
  onReconnect: () => console.log('reconnect'),
  onClose: () => console.log('close'),
})

await session.open()

// If you don't need the session anymore:
await session.close()
```

> You shall not call any other methods on the `session` object before the `session.open` finishes. Before this method successfully finishes you are **not** connected to the actual session and the fields `session.codeSnippet`, `session.terminal`, `session.filesystem`, and `session.process` are `undefined`.

### Run code snippet

You can **run arbitrary code** with the runtime predefined in the Devbook env by calling `session.codeSnippet.run`.

You receive the `stderr`, `stdout`, and the information about the code execution from the `onStderr`, `onStdout`, and `onStateChange` handlers that you can pass to the `Session` constructor inside the `codeSnippet` object.

There can be only **one running code snippet at the same time** — you can stop the one that is currently running by calling `session.codeSnippet.stop`.

```ts
await session.codeSnippet.run('echo 2')

await session.codeSnippet.stop()
```

### Interact with the filesystem

Following filesystem operations are supported.

- **`list`**

Lists content of a directory.
```ts
const dirBContent = await session.filesystem.list('/dirA/dirB')
```

- **`write`**

Writes content to a new file.
```ts
// This will create a new file 'file.txt' inside the dir 'dirB' with the content 'Hello world'.
await session.filesystem.write('/dirA/dirB/file.txt', 'Hello World')
```

- **`read`**

Reads content of a file.
```ts
const fileContent = await session.filesystem.read('/dirA/dirB/file.txt')
```

- **`remove`**

Removes a file or a directory.
```ts
// Remove a file.
await session.filesystem.remove('/dirA/dirB/file.txt')

// Remove a directory and all of its content.
await session.filesystem.remove('/dirA')
```

- **`makeDir`**

Creates a new directory and all directories along the way if needed.
```ts
// Creates a new directory 'dirC' and also 'dirA' and 'dirB' if those directories don't already exist.
await session.filesystem.makeDir('/dirA/dirB/dirC')
```

- **`watchDir`**

Watches a directory for filesystem events.
```ts
const watcher = session.filesystem.watchDir('/dirA/dirB')
watcher.addEventListener(fsevent => {
  console.log('Change inside the dirB', fsevent)
})
await watcher.start()
```

### Start a terminal session

You can **start a new terminal** in the session by calling `session.terminal.createSession`.

> If you want to connect to the same terminal when you reconnect to a session you can use the `terminalID` option when creating the terminal. This is currently used for debugging purposes and when you connect to a special persistent session (`editEnabled` option when creating a new `Session`).

> If you are using frontend terminal component like [Xtermjs](https://github.com/xtermjs/xterm.js/) you want to pass the data from `onData` handler to Xtermjs and forward the data from Xtermjs to the `term.sendData` method.

If you start any **child processes in the terminal** you can use the `onChildProcessesChange` handler and see when they start and exit. You can **kill** the child processes with `session.terminal.killProcess` method.

You can **manually destroy** the terminal by calling `term.destroy`.

```ts
const term = await session.terminal.createSession({
  onExit: () => console.log,
  onData: (data) => console.log(data),
  onChildProcessesChange?: (cps) => console.log(cps),
  size: { cols: 10, rows: 20 },
  terminalID: '<terminal-id>',
})

await term.destroy()

await term.resize({ cols: 1, rows: 1})

await term.sendData('\n')

console.log(term.terminalID)

await session.terminal.killProcess('<child-process-pid>')
```

### Start a process

You can **start a new process** in the session by calling `session.process.start`. The only required option is the `cmd`, but you can also define the `rootdir` and `envVars` options that the command should be executed with.

> If you want to connect to the same process when you reconnect to a session you can use the `processID` option when starting the process. This is currently primarily used for debugging purposes.

You **send the stdin to the process** by calling `proc.sendStdin`.

You can **manually kill** the process by calling `proc.kill`.

```ts
const proc = await session.process.start({
  cmd: 'echo 2',
  onStdout: stdout => consoel.log(stdout),
  onStderr: stderr => console.log(stderr),
  onExit: () => console.log('exit'),
  envVars: { ['ENV']: 'prod' },
  rootdir: '/',
  processID: '<process-id>',
})

await proc.kill()

await proc.sendStdin('\n')

console.log(proc.processID)
```

## Development

You generate the types for Devbook API from OpenAPI spec by calling:

```sh
npm run generate
```

You build the SDK by calling:

```sh
npm run build
```
