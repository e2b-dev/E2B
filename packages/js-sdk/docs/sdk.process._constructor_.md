
## Process.(constructor)

Constructs a new instance of the `Process` class

**Signature:**

```typescript
constructor(processID: string, sandbox: SandboxConnection, triggerExit: () => void, finished: Promise<ProcessOutput>, output: ProcessOutput);
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  processID | string |  |
|  sandbox | SandboxConnection |  |
|  triggerExit | () =&gt; void |  |
|  finished | Promise&lt;[ProcessOutput](./sdk.processoutput.md)<!-- -->&gt; |  |
|  output | [ProcessOutput](./sdk.processoutput.md) |  |

