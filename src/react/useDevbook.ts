import {
  useEffect,
  useState,
  useReducer,
  useCallback,
} from 'react'

import { Evaluator, Template } from 'src/core'

export interface Config {
  template: Template
  port?: number
  code: string
  name?: string
  isShellCommand?: boolean
  autorun?: boolean
}

function useDevbook({
  template,
  port,
  code,
  name,
  isShellCommand,
  autorun,
}: Config) {
  const [evaluator, setEvaluator] = useState<Evaluator>()
  const forceUpdate = useReducer(() => ({}), {})[1]

  const [stderr, setStderr] = useState<string[]>([])
  const [stdout, setStdout] = useState<string[]>([])
  const [cmdOuts, setCmdOuts] = useState<{ stderr: string | null, stdout: string | null }[]>([])

  const url = port && !isShellCommand && evaluator ? evaluator.createURL(port) : undefined

  const runCode = useCallback(() => {
    if (!evaluator) return

    if (isShellCommand) {
      setCmdOuts([])
      evaluator.execShellCodeCell({ command: code })
    } else {
      evaluator.updateCodeCellCode(code)
    }
  }, [
    code,
    evaluator,
    isShellCommand,
  ])

  useEffect(function handleCodeChange() {
    if (!autorun) return
    runCode()
  }, [autorun, runCode])

  useEffect(function initializeEvaluator() {
    const evaluator = new Evaluator({
      template,
      onStderr(stderr) {
        setStderr(s => [...s, stderr])
      },
      onStdout(stdout) {
        setStdout(s => [...s, stdout])
      },
      onCmdOut(cmdOut) {
        setCmdOuts(c => [...c, cmdOut])
      },
      onURLChange() {
        forceUpdate()
      },
    })

    evaluator.createCodeCell({
      name,
      initialCode: code,
      templateID: template,
    })

    setEvaluator(evaluator)
    return () => {
      evaluator.destroy()
    }
  }, [
    template,
    name,
  ])

  return {
    stderr,
    stdout,
    cmdOuts,
    url,
    runCode,
  }
}

export default useDevbook
