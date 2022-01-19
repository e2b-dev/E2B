import {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'

import {
  Devbook,
  Env,
} from 'src/core'
import { SessionStatus } from 'src/core/session/sessionManager'

export interface Opts {
  env: Env
  code: string
  debug?: boolean
}

export enum DevbookStatus {
  Disconnected,
  Connecting,
  WaitingForEnv,
  EnvReady,
  Executing,
}

export interface State {
  stderr: string[]
  stdout: string[]
  /**
   *
   */
  status: DevbookStatus
  /**
   *
   */
  run: () => void
}

/**
 *
 * @param
 * @returns
 */
function useDevbook({
  env,
  code,
  debug,
}: Opts): State {
  const [devbook, setDevbook] = useState<Devbook>()

  const [stderr, setStderr] = useState<string[]>([])
  const [stdout, setStdout] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(SessionStatus.Disconnected)

  const status = useMemo(() => {
    switch (sessionStatus) {
      case SessionStatus.Disconnected:
        return DevbookStatus.Disconnected
      case SessionStatus.Connecting:
        return DevbookStatus.Connecting
      case SessionStatus.Connected:
        if (!isReady) return DevbookStatus.WaitingForEnv
        if (isLoading) return DevbookStatus.Executing
        return DevbookStatus.EnvReady
    }
  }, [isLoading, isReady, sessionStatus])

  const run = useCallback(() => {
    if (!devbook) return
    if (!isReady) return
    if (code === '') return

    // TODO: Fix how we add and delete stderr and stdout -
    // If we try to evaluate code again before the previous evaluation sends outputs
    // then we may receive he results two times without and both results will be saved to stderr/stdout.
    setIsLoading(true)
    setStdout([])
    setStderr([])
    devbook.evaluate(code)
  }, [
    code,
    devbook,
    isReady,
  ])

  useEffect(function initializeDevbook() {
    const devbook = new Devbook({
      debug,
      env,
      onEnvChange(env) {
        setIsReady(env.isReady)
      },
      onStderr(err) {
        setStderr(s => [...s, err])
        setIsLoading(false)
      },
      onStdout(out) {
        setStdout(s => [...s, out])
        setIsLoading(false)
      },
      onSessionChange({ status }) {
        setSessionStatus(status)
      },
    })
    setIsLoading(false)
    setIsReady(false)
    setStdout([])
    setStderr([])
    setDevbook(devbook)
  }, [env, debug])

  return {
    stderr,
    stdout,
    run,
    status,
  }
}

export default useDevbook
