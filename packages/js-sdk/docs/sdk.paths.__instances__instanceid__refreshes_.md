
## paths."/instances/&#123;instanceID&#125;/refreshes" property

**Signature:**

```typescript
"/instances/{instanceID}/refreshes": {
        post: {
            parameters: {
                path: {
                    instanceID: components["parameters"]["instanceID"];
                };
            };
            responses: {
                204: never;
                401: components["responses"]["401"];
                404: components["responses"]["404"];
            };
            requestBody: {
                content: {
                    "application/json": {
                        duration?: number;
                    };
                };
            };
        };
    };
```
