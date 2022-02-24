import {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { useIdleTimer } from 'react-idle-timer'
import {
  Devbook,
  DevbookStatus,
} from '@devbookhq/sdk'

function useCustomDevbook({
  language,
}: {
  language: "javascript" | "python",
}) {
  const [devbook, setDevbook] = useState<Devbook>()
  const [shouldInitialize, setShouldInitialized] = useState(false)
  const [code, setCode] = useState("")
  const [execution, setExecution] = useState(0)

  useIdleTimer({
    timeout: 40 * 1000,
    onIdle() {
      devbook?.__internal__stop()
    },
    onActive() {
      devbook?.__internal__start()
    },
  })

  const [status, setStatus] = useState<DevbookStatus>(DevbookStatus.Disconnected)
  const [stderr, setStderr] = useState<string[]>([])
  const [stdout, setStdout] = useState<string[]>([])

  const env = useMemo(() => {
    switch (language) {
      case "javascript":
        return "banana-node";
      case "python":
        return "banana-python";
    }
  }, [language]);

  const run = useCallback(async (code: string) => {
    if (!devbook) return
    if (status !== DevbookStatus.Connected) return;
    if (code.length === 0) return

    setStdout([])
    setStderr([])

    switch (env) {
      case "banana-node":
        await devbook.fs.write("/index.js", code);
        devbook.runCmd("node index.js");
        break;
      case "banana-python":
        await devbook.fs.write("/main.py", code);
        devbook.runCmd("python3 main.py");
        break;
    }
  }, [
    devbook,
    status,
    env,
  ])

  useEffect(function executeCode() {
    run(code)
  }, [
    run,
    code,
    execution,
  ])

  useEffect(function initializeDevbook() {
    if (!shouldInitialize) return

    const devbook = new Devbook({
      debug: true,
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

    return () => {
      devbook.destroy()
    }
  }, [
    env,
    shouldInitialize,
  ])

  const runCode = useCallback((codeValue: string) => {
    setShouldInitialized(true)
    setCode(codeValue)
    setExecution(e => e + 1)
  }, [])

  return {
    stderr,
    stdout,
    runCode,
    status,
    fs: devbook?.fs,
  }
}

export default useCustomDevbook
