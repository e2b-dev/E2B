import { spawn } from 'child_process'

// Spawn the platform's URL opener ourselves so the 'error' listener is attached
// synchronously. The `open` package (v9.x) only attaches its listener after a
// microtask, by which point a `spawn` ENOENT (e.g. missing `xdg-open` on
// headless Linux) has already been emitted and crashes the process — see
// sindresorhus/open#144.
export function openUrlInBrowser(url: string, onError: () => void): void {
  let command: string
  let args: string[]
  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '""', url.replace(/&/g, '^&')]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.once('error', onError)
    child.unref()
  } catch {
    onError()
  }
}
