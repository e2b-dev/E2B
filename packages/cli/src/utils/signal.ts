import * as os from 'os'

// Signals we handle - filtered to those defined by the OS.
// Note: SIGKILL and SIGSTOP cannot be caught.
const HANDLED_SIGNALS = (
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGPIPE'] as const
).filter((sig) => sig in os.constants.signals)

export function setupSignalHandlers(
  onSignal: NodeJS.SignalsListener
): () => void {
  HANDLED_SIGNALS.forEach((sig) => process.on(sig, onSignal))

  return () =>
    HANDLED_SIGNALS.forEach((sig) => process.removeListener(sig, onSignal))
}
