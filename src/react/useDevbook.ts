import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import {
  Devbook,
  DevbookStatus,
  Env,
} from 'src/core'

export interface Opts {
  env: Env
  debug?: boolean
}

export interface State {
  stderr: string[]
  stdout: string[]
  status: DevbookStatus
  runCode: (code: string) => void
  runCmd: (command: string) => void
}

/**
 *
 * 
 */
function useDevbook({
  env,
  debug,
}: Opts): State {
  const [devbook, setDevbook] = useState<Devbook>()

  const [status, setStatus] = useState<DevbookStatus>(DevbookStatus.Disconnected)
  const [stderr, setStderr] = useState<string[]>([])
  const [stdout, setStdout] = useState<string[]>([])

  const runCmd = useCallback((command: string) => {
    if (!devbook) return
    setStdout([])
    setStderr([])
    devbook.runCmd(command)
  }, [devbook])

  const runCode = useCallback((code: string) => {
    if (!devbook) return
    setStdout([])
    setStderr([])
    devbook.runCode(code)
  }, [devbook])

  useEffect(function initializeDevbook() {
    const devbook = new Devbook({
      debug,
      env,
      onStatusChange(status) {
        setStatus(status)
      },
      onStderr(err) {
        setStderr(s => [...s, err])
      },
      onStdout(out) {
        setStdout(s => [...s, out])
      },
    })
    setStdout([])
    setStderr([])
    setDevbook(devbook)
  }, [env, debug])

  return {
    stderr,
    stdout,
    runCmd,
    runCode,
    status,
  }
}

export default useDevbook
