import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import {
  Devbook,
  Env,
} from 'src/core'

export interface Opts {
  env: Env
  code: string
  debug?: boolean
}

export interface State {
  stderr: string[]
  stdout: string[]
  isReady: boolean
  isLoading: boolean
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

  const run = useCallback(() => {
    if (!devbook) return
    if (!isReady) return
    if (code === '') return

    // TODO: Fix how we add and delete stderr and stdout -
    // If we try to evaluate code again before the previous evaluation sends outputs
    // then we may receive he results two times without and both results will be saved to stderr/stdout.
    setStdout([])
    setStderr([])
    setIsLoading(true)
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
    })
    setStdout([])
    setStderr([])
    setIsLoading(false)
    setIsReady(false)
    setDevbook(devbook)
  }, [env, debug])

  return {
    stderr,
    stdout,
    run,
    isLoading,
    isReady,
  }
}

export default useDevbook
