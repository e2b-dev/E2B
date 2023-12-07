
## api variable

**Signature:**

```typescript
client: {
    configure: (config: openapi_typescript_fetch_dist_cjs_types.FetchConfig) => void;
    use: (mw: fetcher.Middleware) => number;
    path: <P extends keyof paths>(path: P) => {
        method: <M extends keyof paths[P]>(method: M) => {
            create: openapi_typescript_fetch_dist_cjs_types.CreateFetch<M, paths[P][M]>;
        };
    };
}
```
