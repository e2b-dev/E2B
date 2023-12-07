
## DataAnalysis.runPython() method

**Signature:**

```typescript
runPython(code: string, opts?: RunPythonOpts<this>): Promise<{
        stdout: string;
        stderr: string;
        artifacts: Artifact<DataAnalysis>[];
    }>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  code | string |  |
|  opts | [RunPythonOpts](./sdk.runpythonopts.md)&lt;this&gt; | _(Optional)_ |

**Returns:**

Promise&lt;&#123; stdout: string; stderr: string; artifacts: [Artifact](./sdk.artifact.md)&lt;[DataAnalysis](./sdk.dataanalysis.md)&gt;\[\]; &#125;&gt;

