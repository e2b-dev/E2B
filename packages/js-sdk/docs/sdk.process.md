
## Process class

A process running in the sandbox.

**Signature:**

```typescript
declare class Process 
```

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(processID, sandbox, triggerExit, finished, output)](./sdk.process._constructor_.md) |  | Constructs a new instance of the <code>Process</code> class |

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [finished](./sdk.process.finished.md) | <code>readonly</code> | Promise&lt;[ProcessOutput](./sdk.processoutput.md)<!-- -->&gt; |  |
|  [output](./sdk.process.output.md) | <code>readonly</code> | [ProcessOutput](./sdk.processoutput.md) |  |
|  [processID](./sdk.process.processid.md) | <code>readonly</code> | string |  |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [kill()](./sdk.process.kill.md) |  | Kills the process. |
|  [sendStdin(data, opts)](./sdk.process.sendstdin.md) |  | Sends data to the process stdin. |
|  [wait()](./sdk.process.wait.md) |  | Waits for the process to finish. |

