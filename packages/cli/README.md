<p align="center">
  <img width="100" src="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

# E2B CLI

This CLI tool allows you to build manager your running E2B sandbox and sandbox templates. Learn more in [our documentation](https://e2b.dev/docs).

### 1. Install the CLI

**Using Homebrew (on macOS)**

```bash
brew install e2b
```

**Using NPM**

```bash
npm install -g @e2b/cli
```

### 2. Authenticate

```bash
e2b auth login
```

> [!NOTE]
> To authenticate without the ability to open the browser, provide
> `E2B_ACCESS_TOKEN` as an environment variable. You can find your token
> in Account Settings under the Team selector at [e2b.dev/dashboard](https://e2b.dev/dashboard). Then use the CLI like this:
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b template build`.

> [!IMPORTANT]  
> Note the distinction between `E2B_ACCESS_TOKEN` and `E2B_API_KEY`.

### 3. Check out docs

Visit our [CLI documentation](https://e2b.dev/docs) to learn more.
