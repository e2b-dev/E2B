
## paths."/envs/&#123;envID&#125;/builds/&#123;buildID&#125;/logs" property

**Signature:**

```typescript
"/envs/{envID}/builds/{buildID}/logs": {
        post: {
            parameters: {
                path: {
                    envID: components["parameters"]["envID"];
                    buildID: components["parameters"]["buildID"];
                };
            };
            responses: {
                201: unknown;
                401: components["responses"]["401"];
                404: components["responses"]["404"];
            };
            requestBody: {
                content: {
                    "application/json": {
                        apiSecret: string;
                        logs: string[];
                    };
                };
            };
        };
    };
```
