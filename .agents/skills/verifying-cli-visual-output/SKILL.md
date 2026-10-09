---
name: verifying-cli-visual-output
description: "Verify the visual/terminal output of the E2B CLI: tables, colors, alignment, spinners, TTY vs piped behavior. Use when changing anything the CLI prints or when reviewing output formatting."
---

# Verifying CLI Visual Output

The CLI's output style follows kubectl: borderless tables, uppercase headers, left-aligned columns with 3-space padding, no trailing whitespace (`packages/cli/src/utils/table.ts` → `renderTable`). Colors/bold come from `chalk` (`src/utils/format.ts`).

## 1. Unit-test the rendering (preferred)

Capture `console.log` lines and assert exact strings — see `tests/utils/table.test.ts` (`npx vitest run tests/utils/table.test.ts`):

```ts
const lines: string[] = []
vi.spyOn(console, 'log').mockImplementation((l: string) => lines.push(l))
renderTable(rows, columns)
expect(lines).toEqual(['SANDBOX ID   NAME', 'sbx-1        alpha'])
```

Keep row-building logic in exported pure functions (e.g. `buildTableRows` in `src/commands/sandbox/list.ts`) so formatting is testable without the API.

To exercise the renderer directly (e.g. wide chars in a padded middle column), run a small script importing `packages/cli/src/utils/table.ts` with `npx tsx`.

## 2. Eyeball the real output

```bash
cd packages/cli && pnpm build
node dist/index.js sandbox list
```

Checks to make by eye:
- Headers uppercase; columns aligned even with wide cells (widths use `wcswidth`, so CJK/emoji count as 2 cells).
- No borders, no trailing whitespace (`node dist/index.js sandbox list | cat -A` — no spaces before `$`).
- Long values (metadata JSON) don't break alignment of preceding columns.
- Empty result sets print a sensible message, not a lone header or a crash. The team account usually has live sandboxes, so simulate the empty state with a non-matching filter: `node dist/index.js sandbox list --metadata nomatch=zzz` → "No sandboxes found".
- `template list` and `snapshot list` outputs are long; pipe through `head` when capturing.

## 3. TTY vs piped behavior

chalk auto-strips colors when stdout is not a TTY, so piped output must stay clean and parseable:

```bash
node dist/index.js sandbox list | head          # no ANSI escape codes expected
node dist/index.js sandbox list | grep -c $'\e' # should be 0
FORCE_COLOR=1 node dist/index.js sandbox list   # force colors while piping, to inspect them
script -qec "node dist/index.js sandbox list" /dev/null  # run under a real PTY
```

Interactive commands (spinners, prompts via `inquirer`) need a PTY — use the `script` trick above or a tty-enabled shell; never leave them attached in CI-style runs (prefer `--detach` variants).

## 4. Screenshot for PRs

For user-facing output changes, run the command in a real terminal, take a screenshot, and embed it in the PR description — reviewers care about how it looks, not just the strings.

GUI tips: in a 1024px-wide terminal, shrink the font (Konsole: Ctrl+minus x2) so wide tables don't wrap. Typing CJK/emoji via computer-use keyboard drops characters — write test scripts to a file with a file tool and run them from the terminal instead.

## Devin Secrets Needed
- `E2B_API_KEY`
