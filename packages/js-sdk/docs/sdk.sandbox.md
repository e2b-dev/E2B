
## Sandbox class

E2B cloud sandbox gives your agent a full cloud development environment that's sandboxed.

That means: - Access to Linux OS - Using filesystem (create, list, and delete files and dirs) - Run processes - Sandboxed - you can run any code - Access to the internet

Check usage docs - https://e2b.dev/docs/sandbox/overview

These cloud sandboxes are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.

Use the  method to create a new sandbox.

**Signature:**

```typescript
declare class Sandbox extends SandboxConnection 
```
**Extends:** SandboxConnection

## Example


```ts
import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create()

await sandbox.close()
```

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(opts)](./sdk.sandbox._constructor_.md) | <code>protected</code> | Constructs a new instance of the <code>Sandbox</code> class |

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [\_actions](./sdk.sandbox._actions.md) | <code>readonly</code> | Map&lt;string, [Action](./sdk.action.md)&lt;any, any&gt;&gt; |  |
|  [actions](./sdk.sandbox.actions.md) | <code>readonly</code> | Map&lt;string, [Action](./sdk.action.md)&lt;any, any&gt;&gt; | Returns a map of added actions. |
|  [filesystem](./sdk.sandbox.filesystem.md) | <code>readonly</code> | [FilesystemManager](./sdk.filesystemmanager.md) | Filesystem manager used to manage files. |
|  [fileURL](./sdk.sandbox.fileurl.md) | <code>readonly</code> | string | URL that can be used to download or upload file to the sandbox via a multipart/form-data POST request. This is useful if you're uploading files directly from the browser. The file will be uploaded to the user's home directory with the same name. If a file with the same name already exists, it will be overwritten. |
|  [openai](./sdk.sandbox.openai.md) | <code>readonly</code> | &#123; readonly actions: Actions; &#125; | OpenAI integration that can be used to get output for the actions added in the sandbox. |
|  [process](./sdk.sandbox.process.md) | <code>readonly</code> | [ProcessManager](./sdk.processmanager.md) | Process manager used to run commands. |
|  [terminal](./sdk.sandbox.terminal.md) | <code>readonly</code> | [TerminalManager](./sdk.terminalmanager.md) | Terminal manager used to create interactive terminals. |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [\_open(opts)](./sdk.sandbox._open.md) | <code>protected</code> |  |
|  [addAction(action)](./sdk.sandbox.addaction.md) |  | <p>Add a new action. The name of the action is automatically extracted from the function name.</p><p>You can use this action with specific integrations like OpenAI to interact with the sandbox and get output for the action.</p> |
|  [addAction(name, action)](./sdk.sandbox.addaction_1.md) |  | <p>Add a new action with a specified name.</p><p>You can use this action with specific integrations like OpenAI to interact with the sandbox and get output for the action.</p> |
|  [create()](./sdk.sandbox.create.md) | <code>static</code> | Creates a new Sandbox from the default <code>base</code> sandbox template. |
|  [create(template)](./sdk.sandbox.create_1.md) | <code>static</code> | Creates a new Sandbox from the template with the specified ID. |
|  [create(opts)](./sdk.sandbox.create_2.md) | <code>static</code> | Creates a new Sandbox from the specified options. |
|  [downloadFile(remotePath, format)](./sdk.sandbox.downloadfile.md) |  | Downloads a file from the sandbox. |
|  [reconnect(sandboxID)](./sdk.sandbox.reconnect.md) | <code>static</code> | Reconnects to an existing Sandbox. |
|  [reconnect(opts)](./sdk.sandbox.reconnect_1.md) | <code>static</code> | Reconnects to an existing Sandbox. |
|  [removeAction(name)](./sdk.sandbox.removeaction.md) |  | Remove an action. |
|  [uploadFile(file, filename)](./sdk.sandbox.uploadfile.md) |  | <p>Uploads a file to the sandbox. The file will be uploaded to the user's home directory with the same name. If a file with the same name already exists, it will be overwritten.</p><p>\*\*You can use the [Sandbox.fileURL](./sdk.sandbox.fileurl.md) property and upload file directly via POST multipart/form-data\*\*</p> |

