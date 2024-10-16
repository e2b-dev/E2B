<p align="center">
  <img width="100" src="https://github.com/e2b-dev/E2B/blob/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

# E2B CLI

This CLI tool allows you to build manager your running E2B sandbox and sandbox templates. Learn more in [our documentation](https://e2b.dev/docs).

### 1. Install the CLI

```bash
npm install -g @e2b/cli
```

### 2. Authenticate

```bash
e2b auth login
```

> [!NOTE] 
> To authenticate without the ability to open the browser, provide
> `E2B_ACCESS_TOKEN` as an environment variable. Get your `E2B_ACCESS_TOKEN`
> from [e2b.dev/docs](https://e2b.dev/docs). Then use the CLI like this:
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b build`.

### 3. Check out docs
Visit our [CLI documentation](https://e2b.dev/docs) to learn more.
