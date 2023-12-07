
## withAPIKey() function

**Signature:**

```typescript
declare function withAPIKey<T>(f: TypedFetch<T>): WithAPIKey<T> & {
    Error: typeof f.Error;
};
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  f | TypedFetch&lt;T&gt; |  |

**Returns:**

WithAPIKey&lt;T&gt; &amp; &#123; Error: typeof f.Error; &#125;

