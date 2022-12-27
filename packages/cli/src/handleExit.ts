export function handleExit(cleanup: () => void) {
  process.once('SIGINT', () => {
    cleanup()
  }) // CTRL+C

  process.once('SIGQUIT', () => {
    cleanup()
  }) // Keyboard quit

  process.once('SIGTERM', () => {
    cleanup()
  }) // `kill` command
}
