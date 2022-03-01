import {
  useEffect,
  useState,
  useCallback,
} from 'react'

import {
  Devbook,
  DevbookStatus,
  Env,
  FS,
  Config,
} from '../core'

/**
 * Options passed to the {@link useDevbook} hook.
 */
export interface Opts {
  /**
   * Environment that this Devbook should use.
   *
   * This affects which runtime (NodeJS, etc.,...) will be available and used in the {@link State.runCmd} function.
   *
   * {@link useDevbook} hooks with different environments are isolated - each has their own filesystem and process namespace.
   */
  env: Env
  /**
   * If this value is true then this Devbook will print detailed logs.
   */
  debug?: boolean
  /**
   * Devbook config required to correctly start your Devbook VMs.
   */
  config: Config
}

/**
 * Object returned from the {@link useDevbook} hook.
 */
export interface State {
  /**
   * Stderr from the last command run with {@link State.runCmd}.
   *
   * This array is reset when you call {@link State.runCmd}.
   */
  stderr: string[]
  /**
   * Stdout from the command run with {@link State.runCmd}.
   *
   * This array is reset when you call {@link State.runCmd}.
   */
  stdout: string[]
  /**
   * Current status of this Devbook's connection.
   */
  status: DevbookStatus
  /**
   * Run `command` in the VM.
   *
   * This Devbook's VM shares filesystem and process namespace with other Devbooks that were created by passing the same `env`({@link Env}) to the {@link useDevbook} hooks.
   *
   * @param command Command to run
   */
  runCmd: (command: string) => void
  /**
   * Use this for accessing and manipulating this Devbook's VM's filesystem.
   */
  fs?: FS
}

/**
 * React hook for using {@link Devbook} inside of a component.
 *
 * This hook exposes functions for running commands ({@link State.runCmd}) while managing
 * {@link State.stderr}, {@link State.stdout}, and {@link State.status} - reloading the component when these fields change.
 */
function useDevbook({
  env,
  debug,
  config,
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

  useEffect(function initializeDevbook() {
    const devbook = new Devbook({
      debug,
      env,
      config,
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

    return () => {
      devbook.destroy()
    }
  }, [
    env,
    debug,
    config,
  ])

  return {
    stderr,
    stdout,
    runCmd,
    status,
    fs: devbook?.fs,
  }
}

export default useDevbook
