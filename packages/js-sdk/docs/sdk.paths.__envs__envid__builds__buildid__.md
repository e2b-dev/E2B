
## paths."/envs/&#123;envID&#125;/builds/&#123;buildID&#125;" property

**Signature:**

```typescript
"/envs/{envID}/builds/{buildID}": {
        get: {
            parameters: {
                path: {
                    envID: components["parameters"]["envID"];
                    buildID: components["parameters"]["buildID"];
                };
                query: {
                    logsOffset?: number;
                };
            };
            responses: {
                200: {
                    content: {
                        "application/json": components["schemas"]["EnvironmentBuild"];
                    };
                };
                401: components["responses"]["401"];
                404: components["responses"]["404"];
                500: components["responses"]["500"];
            };
        };
    };
```
