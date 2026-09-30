// Vite exposes the runner's `env` config on `import.meta.env`, which the
// browser suite reads instead of `process.env`. The canonical types live in
// `vite/client`, but vite is only a transitive dependency here (via vitest) and
// isn't resolvable from this package, so declare the shape the suite uses.
interface ImportMeta {
  readonly env: Record<string, string | undefined>
}
